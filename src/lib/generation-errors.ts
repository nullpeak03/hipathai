// User-facing error mapping for roadmap generation + a jobId guard.
// Technical failures must surface as one friendly sentence, never a raw
// Postgres message or a silent 10-minute timeout.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Async-route jobIds double as roadmaps.id (uuid). Reject anything else fast. */
export function isValidJobId(jobId: unknown): boolean {
  return typeof jobId === "string" && UUID_RE.test(jobId)
}

export function friendlyGenerationError(raw: string): string {
  const msg = (raw || "").trim()
  if (/uuid/i.test(msg)) {
    return "We couldn't start your roadmap due to a tracking error. Please try again — contact support if it keeps happening."
  }
  // Provider rate limits (Gemini free tier: 20 req/min) read as billing scares
  // in raw form — translate to a calm retry message instead.
  if (/quota|rate.?limit|429|too many requests|generativelanguage/i.test(msg)) {
    return "Our AI is busier than usual right now. Nothing was lost — please wait a minute and try again."
  }
  if (/phases.*roadmap_id|roadmap was deleted during generation/i.test(msg)) {
    return "This roadmap was deleted while it was still generating. Please create a new one."
  }
  if (/foreign key|violates.*constraint/i.test(msg)) {
    return "Your account isn't fully set up yet. Please sign out and sign in again, then retry."
  }
  if (/NIM|ALL_MODELS|gpt|llama|mistral|nim/i.test(msg) && /fail|miss|unavailable|timeout|429|5\d\d/i.test(msg)) {
    return "Our AI is temporarily unavailable. Nothing was lost — please try again in a few minutes."
  }
  if (/supabase|database|postgres|PGRST|fetch|network|ECONN|ENOTFOUND/i.test(msg)) {
    return "We couldn't reach our servers. Check your connection and try again in a minute."
  }
  if (/timeout|timed out|timedout/i.test(msg)) {
    return "Generation is taking longer than usual. Please try again — shorter goals generate faster."
  }
  if (/unauthorized|401/i.test(msg)) {
    return "Your session expired. Please sign in again and retry."
  }
  if (msg.length > 0 && msg.length <= 160) return msg
  return "Something went wrong while generating your roadmap. Please try again."
}

/**
 * Classify a caught Inngest-step error so functions only terminally fail jobs
 * on deterministic errors. Transient provider faults (429/5xx, timeouts,
 * network aborts) must stay `processing` and rethrow for Inngest retry —
 * marking them `failed` immediately is what turned rate-limit bursts into
 * dead roadmaps.
 *
 * Client-safe: duck-types `name`/`status` instead of importing provider or
 * Inngest classes (this module ships in client bundles).
 */
export function classifyJobError(e: unknown): { retriable: boolean; friendly: string } {
  const raw = e instanceof Error ? e.message : String(e ?? "")
  const friendly = friendlyGenerationError(raw)
  const name = e instanceof Error ? e.name : ""
  if (name === "NonRetriableError") return { retriable: false, friendly }
  const status = (e as { status?: unknown } | null)?.status
  if (typeof status === "number") {
    if (status === 408 || status === 429 || (status >= 500 && status <= 599)) {
      return { retriable: true, friendly }
    }
    return { retriable: false, friendly }
  }
  // No status: timeouts/network aborts are retriable, deterministic bugs are not.
  if (/unexpected token|unexpected end|is not valid json|validation|not found|not a uuid|deleted during generation|lesson not found/i.test(raw)) {
    return { retriable: false, friendly }
  }
  return { retriable: true, friendly }
}
