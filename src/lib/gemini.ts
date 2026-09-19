// Google Gemini client — primary AI provider for roadmap, quiz, and tutor.
// Uses the REST generateContent API with responseMimeType JSON enforcement.
// Key from GEMINI_API_KEY (falls back to GOOGLE_API_KEY); never in URLs,
// always via the x-goog-api-key header.
import { extractJsonObject } from "./roadmap-normalize"

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash"
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

export type GeminiChatOptions = {
  /** Model override (default: GEMINI_MODEL). */
  model?: string
  /** Retries on transient failures (default 1). */
  retries?: number
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
  if (!GEMINI_KEY) throw new Error("GEMINI_KEY_MISSING")
  const model = opts.model ?? GEMINI_MODEL
  const retries = opts.retries ?? 1
  const url = `${GEMINI_BASE}/models/${model}:generateContent`
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT)
      let res: Response
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
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
      const retriable = isRetriableStatus(geminiStatus(e))
      console.warn(
        `[gemini] ${model} attempt ${attempt + 1} failed (${retriable ? "retriable" : "fatal"}):`,
        e instanceof Error ? e.message.slice(0, 200) : e
      )
      if (retriable && attempt < retries) {
        await sleep(RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)])
        continue
      }
      throw e
    }
  }
  throw new Error("GEMINI_FAILED")
}
