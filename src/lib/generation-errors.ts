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
