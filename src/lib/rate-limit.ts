// Per-user sliding-window rate limiting for AI endpoints.
// In-memory (per server instance) — good enough to stop casual abuse and
// runaway loops; for multi-instance strictness use an external store.
// NOTE: always fail CLOSED on errors at call sites (allow the request).

type Bucket = { hits: number[] }

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 5000

export const HOUR_MS = 60 * 60 * 1000

/** Sane defaults: strict on expensive generation, loose on chat. */
export const RATE_LIMITS = {
  roadmap: { limit: 5, windowMs: HOUR_MS },
  lesson: { limit: 10, windowMs: HOUR_MS },
  quiz: { limit: 30, windowMs: HOUR_MS },
  tutor: { limit: 60, windowMs: HOUR_MS },
  weakness: { limit: 30, windowMs: HOUR_MS },
} as const

export type RateLimitKey = keyof typeof RATE_LIMITS

export type RateLimitResult = { ok: true } | { ok: false; retryAfterMs: number }

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { hits: [] }
    if (buckets.size >= MAX_BUCKETS) {
      const oldest = buckets.keys().next().value
      if (oldest !== undefined) buckets.delete(oldest)
    }
    buckets.set(key, bucket)
  }
  const cutoff = now - windowMs
  bucket.hits = bucket.hits.filter((t) => t > cutoff)
  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0] ?? now
    return { ok: false, retryAfterMs: Math.max(0, oldest + windowMs - now) }
  }
  bucket.hits.push(now)
  return { ok: true }
}

/** Clear all buckets (tests). */
export function resetRateLimits(): void {
  buckets.clear()
}
