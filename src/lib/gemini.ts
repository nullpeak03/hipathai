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
export class GeminiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = "GeminiError"
    this.status = status
  }
}

/** Retry transient failures (timeout, 429, 5xx). Fatal: 400/401/403/404. */
export function isRetriableStatus(status: number | undefined): boolean {
  if (status === undefined) return true
  if (status === 408 || status === 429) return true
  return status >= 500 && status <= 599
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function geminiStatus(e: unknown): number | undefined {
  return e instanceof GeminiError ? e.status : undefined
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
}

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
        // Enforce a valid object (roadmap or quiz), never a fragment.
        const extracted = extractJsonObject(content, ["phases", "questions", "lessons"])
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
      console.warn(
        `[gemini] ${model} [${keySource}] attempt ${attempt + 1} failed (${retriable ? "retriable" : "fatal"}):`,
        e instanceof Error ? e.message.slice(0, 200) : e
      )
      if (retriable && attempt < retries) {
        await sleep(RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)])
        continue
      }
      throw e
    }
    }
  }
  throw new Error("GEMINI_FAILED")
}
