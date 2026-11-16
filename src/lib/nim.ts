// NVIDIA NIMs client (OpenAI-compatible chat completions) for the Nemotron
// + Muse lineup. Verified live 2026-09-20 — every model below returned
// HTTP 200 on the project key. Thinking-capable Nemotron variants take
// chat_template_kwargs.enable_thinking=false (required: without it they
// stream reasoning until timeout).
import { extractJsonObject } from "./roadmap-normalize"
import { ProviderError, isRetriableStatus, providerStatus, sleep } from "./ai-errors"
import { logInfo } from "./logger"

export { ProviderError as NimError }

/** Read live per request (tests, rotations, and env changes just work). */
function nimBase(): string {
  return process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1/chat/completions"
}

/**
 * API keys in failover order, de-duplicated.
 *
 * The second key is optional and exists for what a same-vendor model fallback
 * cannot fix: a revoked, rate-limited or quota-exhausted key. It does NOT
 * cover a provider-wide outage — that still needs a different vendor.
 */
export function nimApiKeys(): string[] {
  const keys = [process.env.NVIDIA_NIM_API_KEY, process.env.NVIDIA_NIM_API_KEY_2]
    .map((key) => (key || "").trim())
    .filter(Boolean)
  return [...new Set(keys)]
}

/**
 * Failures that belong to the key, not the model or the network: the key is
 * rejected (401/403) or has hit its account-level rate/quota (429).
 * Rotating keys is worth an immediate attempt; retrying the same key is not.
 */
function isKeyScopedFailure(e: unknown): boolean {
  if (!(e instanceof ProviderError)) return false
  return e.status === 401 || e.status === 402 || e.status === 403 || e.status === 429
}

const DEFAULT_TIMEOUT = 60000
const RETRY_DELAYS = [2000, 5000]

export type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>
}

export type NimCallOptions = {
  model: string
  messages: ChatMessage[]
  jsonMode?: boolean
  /** Array keys a valid response must contain (e.g. ["sections"] for lessons). */
  jsonKeys?: string[]
  timeoutMs?: number
  /**
   * Absolute epoch-ms deadline shared by every attempt (including retries).
   * Without it, a 45s per-call timeout plus one retry quietly becomes a 92s
   * step — past the platform's ~60s invocation cap, which kills the whole
   * job with an opaque timeout instead of a real provider error.
   */
  deadlineAt?: number
  maxTokens?: number
  /** Disable chain-of-thought (required for Nemotron reasoning variants). */
  thinkingDisabled?: boolean
  retries?: number
  /**
   * Return raw text when JSON extraction fails instead of throwing. For
   * prose-tolerant consumers only (tutor: parseTutorContent paragraph-wraps
   * anything) — strict features must keep failing so bad JSON never ships.
   */
  allowRaw?: boolean
  /** Enable SSE streaming (for tutor chat). */
  stream?: boolean
}

const DEFAULT_JSON_KEYS = ["phases", "questions", "lessons"]

export async function callNim(opts: NimCallOptions): Promise<{ modelUsed: string; content: string }> {
  const { model, messages, jsonMode = false, timeoutMs, maxTokens = 2000 } = opts
  const jsonKeys = opts.jsonKeys ?? DEFAULT_JSON_KEYS
  const retries = opts.retries ?? 1
  const keys = nimApiKeys()
  if (keys.length === 0) throw new Error("NIM_KEY_MISSING")
  let keyIndex = 0
  let attempt = 0
  let nvcfRetries = 0
  while (true) {
    const apiKey = keys[keyIndex]
    const started = Date.now()
    // Never start an attempt that cannot fit inside the shared deadline.
    // A 403 from a revoked/truncated key is already named below, so this is
    // only about wall-clock safety.
    const remaining = opts.deadlineAt === undefined ? Infinity : opts.deadlineAt - started
    if (remaining <= 0) {
      throw new ProviderError(`nim/${model}: Request timed out after ${timeoutMs ?? DEFAULT_TIMEOUT}ms`)
    }
    try {
      const limitMs = Math.max(1, Math.min(timeoutMs ?? DEFAULT_TIMEOUT, remaining))
      const controller = new AbortController()
      let timedOut = false
      const timeout = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, limitMs)
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
        // Network error / abort. Name the timeout case explicitly: undici's
        // bare "This operation was aborted" is opaque in logs AND leaked
        // verbatim to users (it matched no friendly-error rule).
        if (timedOut) throw new ProviderError(`nim/${model}: Request timed out after ${limitMs}ms`)
        throw new ProviderError(`nim/${model}: Request failed: ${e instanceof Error ? e.message : String(e)}`)
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
        const authPrefix = res.status === 401 || res.status === 403 ? "NIM_AUTH_FAILED " : ""
        throw new ProviderError(`${authPrefix}nim/${model}: HTTP ${res.status} ${body}`, res.status, retryAfterMs)
      }
      const data = await res.json()
      const raw =
        (data.choices?.[0]?.message?.content as string | null | undefined) ??
        (data.choices?.[0]?.message?.reasoning_content as string | null | undefined)
      if (!raw || !raw.trim()) throw new ProviderError(`nim/${model}: Empty content`, res.status)
      logInfo("nim_success", { model, latencyMs: Date.now() - started, maxTokens })
      let content: string = raw
      if (jsonMode) {
        // Enforce a valid object for this feature's contract, never a fragment.
        const extracted = extractJsonObject(content, jsonKeys)
        if (!extracted) {
          // Lenient consumers (tutor) accept prose: their parser wraps any
          // non-empty text into paragraph blocks downstream.
          if (opts.allowRaw && raw.trim().length > 0) {
            return { modelUsed: `nim/${model}`, content: raw }
          }
          throw new ProviderError(`nim/${model}: Invalid JSON from model`)
        }
        content = extracted
      }
      return { modelUsed: `nim/${model}`, content }
    } catch (e) {
      const rawError = e instanceof Error ? e.message : String(e)
      // NVCF sometimes routes a request to a backend deployment that is not
      // provisioned for the account, returning 404 "Function '<uuid>': Not
      // found for account". It is cheap and often effective to retry a couple
      // of times on a different node before giving up on the model.
      const nvcfNotFound = /not found for account/i.test(rawError)
      const retriable = isRetriableStatus(providerStatus(e)) || nvcfNotFound
      const serverWait = e instanceof ProviderError && typeof e.retryAfterMs === "number"
        ? Math.min(60000, e.retryAfterMs + 1000)
        : null
      console.warn(
        `[nim] ${model} attempt ${attempt + 1 + nvcfRetries} failed (${retriable ? "retriable" : "fatal"})${serverWait !== null ? ` retry in ${serverWait}ms` : ""}:`,
        rawError.slice(0, 200)
      )
      // A rejected/rate-limited key will not heal by retrying it. Switch keys
      // immediately — no sleep, so this costs one round-trip, not a timeout.
      const keyDeadlineOk = opts.deadlineAt === undefined || Date.now() < opts.deadlineAt
      if (isKeyScopedFailure(e) && keyIndex + 1 < keys.length && keyDeadlineOk) {
        console.warn(`[nim] ${model} key slot ${keyIndex + 1} failed (HTTP ${providerStatus(e)}) — trying key slot ${keyIndex + 2}`)
        keyIndex += 1
        continue
      }
      if (nvcfNotFound && nvcfRetries < 2) {
        nvcfRetries += 1
        const wait = 400 * nvcfRetries
        if (opts.deadlineAt !== undefined && Date.now() + wait >= opts.deadlineAt) throw e
        await sleep(wait)
        continue
      }
      if (retriable && attempt < retries) {
        attempt += 1
        const wait = serverWait ?? RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)]
        // Don't sleep past the deadline and then start a doomed attempt.
        if (opts.deadlineAt !== undefined && Date.now() + wait >= opts.deadlineAt) throw e
        await sleep(wait)
        continue
      }
      throw e
    }
  }
}

/** Streaming variant — yields SSE chunks for real-time tutor responses. */
export async function* callNimStream(opts: NimCallOptions): AsyncGenerator<string, void, unknown> {
  const { model, messages, jsonMode = false, timeoutMs, maxTokens = 2000 } = opts
  const keys = nimApiKeys()
  if (keys.length === 0) throw new Error("NIM_KEY_MISSING")
  const limitMs = timeoutMs ?? DEFAULT_TIMEOUT
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, limitMs)
  try {
    let res: Response | undefined
    for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
      const attempt = await fetch(nimBase(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${keys[keyIndex]}` },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: maxTokens,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
          ...(opts.thinkingDisabled === true
            ? { chat_template_kwargs: { enable_thinking: false } }
            : {}),
          stream: true,
        }),
        signal: controller.signal,
      })
      if (attempt.ok) {
        res = attempt
        break
      }
      const body = await attempt.text()
      const err = new ProviderError(`nim/${model}: HTTP ${attempt.status} ${body}`, attempt.status)
      // Rotate keys before the stream starts: nothing has been yielded yet, so
      // a rejected/rate-limited key costs one round-trip, not a broken reply.
      if (isKeyScopedFailure(err) && keyIndex + 1 < keys.length) {
        console.warn(`[nim] ${model} stream key slot ${keyIndex + 1} failed (HTTP ${attempt.status}) — trying key slot ${keyIndex + 2}`)
        continue
      }
      throw err
    }
    if (!res) throw new ProviderError(`nim/${model}: No usable NIM key`)
    clearTimeout(timeout)
    if (!res.body) throw new ProviderError("No response body")
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim()
          if (data === "[DONE]") return
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) yield delta
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }
  } catch (e) {
    clearTimeout(timeout)
    if (timedOut) throw new ProviderError(`nim/${model}: Request timed out after ${limitMs}ms`)
    throw e instanceof ProviderError ? e : new ProviderError(`nim/${model}: Request failed: ${e instanceof Error ? e.message : String(e)}`)
  }
}
