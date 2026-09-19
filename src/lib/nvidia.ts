// Nvidia NIMs client — verified 2026-09-19 against the live platform:
// this account's key is entitled ONLY to openai/gpt-oss-20b (every other
// candidate returns 404/410). The chain below is therefore single-model by
// default; NIM_FALLBACK_MODELS can extend it if key entitlement grows.
// Resilience comes from retries with backoff on transient failures
// (timeouts, 429, 5xx), never from hopping to dead models.
import { extractJsonObject } from "./roadmap-normalize"
let rawBase = process.env.NVIDIA_NIM_BASE_URL || process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1/chat/completions"
if (rawBase.endsWith("/v1") || rawBase.endsWith("/v1/")) rawBase = rawBase.replace(/\/$/, "") + "/chat/completions"
const NIM_BASE = rawBase
// Verified working 2026-09-19 (HTTP 200 + valid JSON). All legacy candidates
// (llama-3.1-*, nemotron-70b, mixtral-8x22b, gemma-2-27b, gpt-oss-120b) are
// 404/410 on this key — do NOT re-add them without re-verifying.
const FALLBACK_MODELS = (process.env.NIM_FALLBACK_MODELS || "openai/gpt-oss-20b").split(",").map(s=>s.trim()).filter(Boolean)
const NIM_KEY = process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY || ""
// Per-model timeouts (ms). Full 40-lesson generations take ~60s on
// gpt-oss-20b — callers with tight budgets pass an explicit timeoutMs.
const MODEL_TIMEOUTS: Record<string, number> = {
  "openai/gpt-oss-20b": 20000,
}
const DEFAULT_TIMEOUT = 20000
const RETRY_DELAYS = [2000, 5000]

export type ChatMessage = { role: "system"|"user"|"assistant", content: string }

/** Error carrying the upstream HTTP status (undefined = network/timeout). */
export class NimError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = "NimError"
    this.status = status
  }
}

/** Retry transient failures (timeout, 429, 5xx). Fatal: 400/401/403/404/410. */
export function isRetriableStatus(status: number | undefined): boolean {
  if (status === undefined) return true
  if (status === 408 || status === 429) return true
  return status >= 500 && status <= 599
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function nimStatus(e: unknown): number | undefined {
  return e instanceof NimError ? e.status : undefined
}

export type ChatOptions = {
  /** Retries per model on transient failures (default: 1 single-model, 0 chain). */
  retries?: number
}

function defaultRetries(): number {
  return FALLBACK_MODELS.length > 1 ? 0 : 1
}

export async function chatWithFallback(
  messages: ChatMessage[],
  jsonMode=false,
  timeoutMs?: number,
  maxTokens=2000,
  opts: ChatOptions = {}
): Promise<{modelUsed:string, content:string}> {
  if (!NIM_KEY) throw new Error("NIM_KEY_MISSING")
  const retries = opts.retries ?? defaultRetries()
  for (const model of FALLBACK_MODELS) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController()
        const modelTimeout = timeoutMs ?? MODEL_TIMEOUTS[model] ?? DEFAULT_TIMEOUT
        const timeout = setTimeout(()=>controller.abort(), modelTimeout)
        let res: Response
        try {
          res = await fetch(NIM_BASE, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${NIM_KEY}` },
            body: JSON.stringify({
              model,
              messages,
              temperature: 0.7,
              max_tokens: maxTokens,
              ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
              stream: false
            }),
            signal: controller.signal
          })
        } catch (e) {
          // Network error / abort (timeout) — retriable, no status
          throw new NimError(`Request failed: ${e instanceof Error ? e.message : String(e)}`)
        } finally {
          clearTimeout(timeout)
        }
        if (!res.ok) throw new NimError(`HTTP ${res.status} ${await res.text()}`, res.status)
        const data = await res.json()
        const raw = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.message?.reasoning
        if (!raw) throw new NimError("Empty content", res.status)
        let content = raw
        if (jsonMode) {
          // Models wrap JSON in fences, thinking traces, or trailing chatter —
          // extract the largest valid object (roadmap or quiz), never a fragment.
          const extracted = extractJsonObject(content, ["phases", "questions", "lessons"])
          if (!extracted) throw new NimError("Invalid JSON from model")
          content = extracted
        }
        return { modelUsed: model, content }
      } catch (e) {
        const retriable = isRetriableStatus(nimStatus(e))
        console.warn(`[nvidia] ${model} attempt ${attempt + 1} failed (${retriable ? "retriable" : "fatal"}):`, e instanceof Error ? e.message.slice(0, 200) : e)
        if (retriable && attempt < retries) {
          await sleep(RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)])
          continue
        }
        break // next model (or give up when single-model)
      }
    }
  }
  throw new Error("ALL_MODELS_FAILED")
}

// streaming with fallback (tutor path; single quick retry on transient errors)
export async function* streamWithFallback(messages: ChatMessage[], isAsync=false, maxTokens=4000): AsyncGenerator<string> {
  // try models sequentially until one streams successfully
  for (const model of FALLBACK_MODELS) {
    for (let attempt = 0; attempt <= (FALLBACK_MODELS.length > 1 ? 0 : 1); attempt++) {
      try {
        const controller = new AbortController()
        const modelTimeout = isAsync ? 60000 : (MODEL_TIMEOUTS[model] ?? DEFAULT_TIMEOUT)
        const timeout = setTimeout(()=>controller.abort(), modelTimeout)
        let res: Response
        try {
          res = await fetch(NIM_BASE, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${NIM_KEY}` },
            body: JSON.stringify({ model, messages, stream: true, temperature: 0.7, max_tokens: maxTokens }),
            signal: controller.signal
          })
        } catch (e) {
          throw new NimError(`Request failed: ${e instanceof Error ? e.message : String(e)}`)
        } finally {
          clearTimeout(timeout)
        }
        if (!res.ok || !res.body) throw new NimError(`HTTP ${res.status}`, res.status)
        // if got body, yield chunks
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        // yield marker
        yield `__MODEL__:${model}\n`
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          // parse SSE
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim()
              if (data === "[DONE]") return
              try {
                const json = JSON.parse(data)
                const delta = json.choices?.[0]?.delta?.content
                if (delta) yield delta
              } catch {}
            }
          }
        }
        return
      } catch (e) {
        const retriable = isRetriableStatus(nimStatus(e))
        console.warn(`[nvidia-stream] ${model} attempt ${attempt + 1} failed (${retriable ? "retriable" : "fatal"}):`, e instanceof Error ? e.message.slice(0, 200) : e)
        if (retriable && attempt < 1 && FALLBACK_MODELS.length === 1) {
          await sleep(RETRY_DELAYS[0])
          continue
        }
        break
      }
    }
  }
  throw new Error("ALL_MODELS_FAILED_STREAM")
}
