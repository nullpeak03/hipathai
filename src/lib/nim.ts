// NVIDIA NIMs client (OpenAI-compatible chat completions) for the Nemotron
// + Muse lineup. Verified live 2026-09-20 — every model below returned
// HTTP 200 on the project key. Thinking-capable Nemotron variants take
// chat_template_kwargs.enable_thinking=false (required: without it they
// stream reasoning until timeout).
import { extractJsonObject } from "./roadmap-normalize"
import { ProviderError, isRetriableStatus, providerStatus, sleep } from "./ai-errors"

export { ProviderError as NimError }

/** Read live per request (tests, rotations, and env changes just work). */
function nimBase(): string {
  return process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1/chat/completions"
}
function nimApiKey(): string {
  return process.env.NVIDIA_NIM_API_KEY || ""
}

const DEFAULT_TIMEOUT = 60000
const RETRY_DELAYS = [2000, 5000]

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string }

export type NimCallOptions = {
  model: string
  messages: ChatMessage[]
  jsonMode?: boolean
  /** Array keys a valid response must contain (e.g. ["sections"] for lessons). */
  jsonKeys?: string[]
  timeoutMs?: number
  maxTokens?: number
  /** Disable chain-of-thought (required for Nemotron reasoning variants). */
  thinkingDisabled?: boolean
  retries?: number
}

const DEFAULT_JSON_KEYS = ["phases", "questions", "lessons"]

export async function callNim(opts: NimCallOptions): Promise<{ modelUsed: string; content: string }> {
  const { model, messages, jsonMode = false, timeoutMs, maxTokens = 2000 } = opts
  const jsonKeys = opts.jsonKeys ?? DEFAULT_JSON_KEYS
  const retries = opts.retries ?? 1
  const apiKey = nimApiKey()
  if (!apiKey) throw new Error("NIM_KEY_MISSING")
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT)
      let res: Response
      try {
        res = await fetch(nimBase(), {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.7,
            max_tokens: maxTokens,
            ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
            ...(opts.thinkingDisabled === true
              ? { chat_template_kwargs: { enable_thinking: false } }
              : {}),
            stream: false,
          }),
          signal: controller.signal,
        })
      } catch (e) {
        // Network error / abort (timeout) — retriable, no status
        throw new ProviderError(`Request failed: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        clearTimeout(timeout)
      }
      if (!res.ok) {
        const body = await res.text()
        // Honor server-requested waits so 429 bursts back off instead of hammering.
        let retryAfterMs: number | undefined
        if (res.status === 429) {
          const header = res.headers.get("retry-after")
          const secs = header ? parseFloat(header) : NaN
          if (Number.isFinite(secs)) {
            retryAfterMs = Math.min(60000, Math.max(0, secs * 1000))
          } else {
            const m = body.match(/retry in (\d+(?:\.\d+)?)s/i)
            if (m) retryAfterMs = Math.min(60000, Math.ceil(parseFloat(m[1]) * 1000))
          }
        }
        throw new ProviderError(`HTTP ${res.status} ${body}`, res.status, retryAfterMs)
      }
      const data = await res.json()
      const raw =
        (data.choices?.[0]?.message?.content as string | null | undefined) ??
        (data.choices?.[0]?.message?.reasoning_content as string | null | undefined)
      if (!raw || !raw.trim()) throw new ProviderError("Empty content", res.status)
      let content: string = raw
      if (jsonMode) {
        // Enforce a valid object for this feature's contract, never a fragment.
        const extracted = extractJsonObject(content, jsonKeys)
        if (!extracted) throw new ProviderError("Invalid JSON from model")
        content = extracted
      }
      return { modelUsed: `nim/${model}`, content }
    } catch (e) {
      const retriable = isRetriableStatus(providerStatus(e))
      const serverWait = e instanceof ProviderError && typeof e.retryAfterMs === "number"
        ? Math.min(60000, e.retryAfterMs + 1000)
        : null
      console.warn(
        `[nim] ${model} attempt ${attempt + 1} failed (${retriable ? "retriable" : "fatal"})${serverWait !== null ? ` retry in ${serverWait}ms` : ""}:`,
        e instanceof Error ? e.message.slice(0, 200) : e
      )
      if (retriable && attempt < retries) {
        await sleep(serverWait ?? RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)])
        continue
      }
      throw e
    }
  }
  throw new Error("NIM_FAILED")
}
