// Google Gemini client — primary AI provider for roadmap, quiz, and tutor.
// Uses the REST generateContent API with responseMimeType JSON enforcement.
// Two-key quota isolation (see .env.example): heavy generation uses the
// roadmap key, real-time quiz/tutor use the interactive key. Each falls back
// to the shared GEMINI_API_KEY/GOOGLE_API_KEY. NOTE: quotas are enforced per
// Google Cloud project — the two keys isolate traffic ONLY when they live in
// separate projects; same-project keys share one pool.
// Auth-class failures (401/403/404) on a dedicated key fail over once to the
// shared pool instead of erroring, and log loudly so bad keys get fixed.
import { extractJsonObject } from "./roadmap-normalize"
import {
  ProviderError,
  isRetriableStatus,
  providerStatus as geminiStatus,
  sleep,
} from "./ai-errors"

export { isRetriableStatus }

export type GeminiKeyKind = "roadmap" | "interactive"

/** Resolve the API key live (per request, so tests and rotations just work). */
export function resolveApiKey(kind: GeminiKeyKind): string {
  return resolveApiKeySource(kind).key
}

/** Which env var backs a pool — the NAME only, never the value (safe to log). */
export function resolveApiKeySource(kind: GeminiKeyKind): { key: string; source: string } {  if (kind === "roadmap" && process.env.GEMINI_API_KEY_ROADMAP) {
    return { key: process.env.GEMINI_API_KEY_ROADMAP, source: "GEMINI_API_KEY_ROADMAP" }
  }
  if (kind === "interactive" && process.env.GEMINI_API_KEY_TUTOR) {
    return { key: process.env.GEMINI_API_KEY_TUTOR, source: "GEMINI_API_KEY_TUTOR" }
  }
  if (process.env.GEMINI_API_KEY) {
    return { key: process.env.GEMINI_API_KEY, source: "GEMINI_API_KEY" }
  }
  if (process.env.GOOGLE_API_KEY) {
    return { key: process.env.GOOGLE_API_KEY, source: "GOOGLE_API_KEY" }
  }
  return { key: "", source: "missing" }
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash"
const GEMINI_BASE =
  process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta"

// Per-call timeouts (ms). Flash models are fast; background jobs pass more.
const DEFAULT_TIMEOUT = 20000
const RETRY_DELAYS = [2000, 5000]

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string }

/** Error carrying the upstream HTTP status (undefined = network/timeout). */
export class GeminiError extends ProviderError {
  constructor(message: string, status?: number) {
    super(message, status)
    this.name = "GeminiError"
  }
}

function isDedicatedSource(source: string): boolean {
  return source === "GEMINI_API_KEY_ROADMAP" || source === "GEMINI_API_KEY_TUTOR"
}

function sharedKeySource(): { key: string; source: string } | null {
  if (process.env.GEMINI_API_KEY) return { key: process.env.GEMINI_API_KEY, source: "GEMINI_API_KEY" }
  if (process.env.GOOGLE_API_KEY) return { key: process.env.GOOGLE_API_KEY, source: "GOOGLE_API_KEY" }
  return null
}

export type GeminiChatOptions = {
  /** Model override (default: GEMINI_MODEL). */
  model?: string
  /** Retries on transient failures (default 1). */
  retries?: number
  /** Quota pool: heavy generation ("roadmap") or real-time ("interactive"). */
  key?: GeminiKeyKind
  /** Array keys a valid response must contain (e.g. ["sections"] for lessons). */
  jsonKeys?: string[]
}

const DEFAULT_JSON_KEYS = ["phases", "questions", "lessons"]

type GeminiPart = { text: string }
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] }

function toGeminiPayload(messages: ChatMessage[], jsonMode: boolean, maxTokens: number) {
  const systemText = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n")
  const contents: GeminiContent[] = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }))
  return {
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: maxTokens,
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  }
}

function parseReply(data: unknown): string {
  const d = data as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
    promptFeedback?: { blockReason?: string }
  }
  const blockReason = d?.promptFeedback?.blockReason
  if (blockReason) throw new GeminiError(`Blocked by safety filters: ${blockReason}`)
  const text = (d?.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p?.text ?? "")
    .join("")
    .trim()
  if (!text) throw new GeminiError("Empty content from model")
  return text
}

export async function chatWithGemini(
  messages: ChatMessage[],
  jsonMode = false,
  timeoutMs?: number,
  maxTokens = 2000,
  opts: GeminiChatOptions = {}
): Promise<{ modelUsed: string; content: string }> {
  const model = opts.model ?? GEMINI_MODEL
  const retries = opts.retries ?? 1
  const jsonKeys = opts.jsonKeys ?? DEFAULT_JSON_KEYS
  const primary = resolveApiKeySource(opts.key ?? "interactive")
  if (!primary.key) throw new Error("GEMINI_KEY_MISSING")
  // Auth-class failures (denied project, revoked key) never self-heal by
  // retry — fail over once to the shared pool instead of erroring out.
  const shared = sharedKeySource()
  const pools = [primary]
  if (shared && shared.key !== primary.key && isDedicatedSource(primary.source)) {
    pools.push(shared)
  }
  const url = `${GEMINI_BASE}/models/${model}:generateContent`
  for (let pi = 0; pi < pools.length; pi++) {
    const { key: apiKey, source: keySource } = pools[pi]
    const canFailOver = pi < pools.length - 1
    for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT)
      let res: Response
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(toGeminiPayload(messages, jsonMode, maxTokens)),
          signal: controller.signal,
        })
      } catch (e) {
        // Network error / abort (timeout) — retriable, no status
        throw new GeminiError(`Request failed: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        clearTimeout(timeout)
      }
      if (!res.ok) {
        let detail = ""
        try {
          const errBody = (await res.json()) as { error?: { message?: string } }
          detail = errBody?.error?.message ? ` ${errBody.error.message}` : ""
        } catch {
          // fall through with status only
        }
        throw new GeminiError(`HTTP ${res.status}${detail}`, res.status)
      }
      const data = await res.json()
      let content = parseReply(data)
      if (jsonMode) {
        // Enforce a valid object for this feature's contract, never a fragment.
        const extracted = extractJsonObject(content, jsonKeys)
        if (!extracted) throw new GeminiError("Invalid JSON from model")
        content = extracted
      }
      return { modelUsed: `gemini/${model}`, content }
    } catch (e) {
      const status = geminiStatus(e)
      if ((status === 401 || status === 403 || status === 404) && canFailOver) {
        console.warn(
          `[gemini] ${model} [${keySource}] denied access — failing over to ${pools[pi + 1]?.source ?? "shared"} pool (check the denied key's project):`,
          e instanceof Error ? e.message.slice(0, 200) : e
        )
        break
      }
      const retriable = isRetriableStatus(status)
      // Respect Gemini's Retry-After (e.g. "Please retry in 41.03s") for 429s
      let retryDelay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)]
      if (status === 429 && e instanceof Error) {
        const m = e.message.match(/retry in (\d+(?:\.\d+)?)s/i)
        if (m) retryDelay = Math.min(60000, Math.ceil(parseFloat(m[1]) * 1000) + 1000)
      }
      // On 503 high demand, try fallback model (3.6-flash is busiest) before retrying same model
      if (status === 503 && attempt === 0 && model.includes("3.6-flash")) {
        const fallbackModel = model.replace("3.6-flash", "2.0-flash")
        console.warn(`[gemini] ${model} overloaded, trying fallback ${fallbackModel}`)
        try {
          const fallbackUrl = `${GEMINI_BASE}/models/${fallbackModel}:generateContent`
          const fbRes = await fetch(fallbackUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify(toGeminiPayload(messages, jsonMode, maxTokens)),
          })
          if (fbRes.ok) {
            const fbData = await fbRes.json()
            let fbContent = parseReply(fbData)
            if (jsonMode) {
              const extracted = extractJsonObject(fbContent, jsonKeys)
              if (extracted) fbContent = extracted
              else throw new GeminiError("Invalid JSON from model")
            }
            console.log(`[gemini] fallback ${fallbackModel} succeeded`)
            return { modelUsed: `gemini/${fallbackModel}`, content: fbContent }
          }
        } catch (fbE) {
          console.warn(`[gemini] fallback ${fallbackModel} also failed:`, fbE instanceof Error ? fbE.message.slice(0, 120) : fbE)
        }
      }
      console.warn(
        `[gemini] ${model} [${keySource}] attempt ${attempt + 1} failed (${retriable ? "retriable" : "fatal"})${status === 429 ? ` retry in ${retryDelay}ms` : ""}:`,
        e instanceof Error ? e.message.slice(0, 200) : e
      )
      if (retriable && attempt < retries) {
        await sleep(retryDelay)
        continue
      }
      throw e
    }
    }
  }
  throw new Error("GEMINI_FAILED")
}
