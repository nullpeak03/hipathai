// Per-user sliding-window rate limiting for AI endpoints.
// Primary store is Supabase (shared across serverless instances); an
// in-memory fallback covers tests, local dev, and DB outages.
// NOTE: always fail CLOSED on errors at call sites (allow the request).

import { createServerClient } from "./supabase/server"

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

function checkMemory(key: string, limit: number, windowMs: number, now: number): RateLimitResult {
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

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): Promise<RateLimitResult> {
  // Unit tests must never touch the database.
  if (process.env.NODE_ENV === "test") {
    return checkMemory(key, limit, windowMs, now)
  }
  try {
    const supabase = createServerClient()
    const cutoff = new Date(now - windowMs).toISOString()
    // Prune expired hits (global; cheap at this volume).
    await supabase.from("rate_limit_hits").delete().lt("ts", cutoff)
    const { data: oldestRows, error: countError } = await supabase
      .from("rate_limit_hits")
      .select("ts", { count: "exact" })
      .eq("key", key)
      .gt("ts", cutoff)
      .order("ts", { ascending: true })
      .limit(limit + 1)
    if (countError) throw countError
    const rows = (oldestRows ?? []) as { ts: string }[]
    if (rows.length >= limit) {
      const oldest = new Date(rows[0]?.ts ?? cutoff).getTime()
      return { ok: false, retryAfterMs: Math.max(0, oldest + windowMs - now) }
    }
    const { error: insertError } = await supabase
      .from("rate_limit_hits")
      .insert({ key, ts: new Date(now).toISOString() })
    if (insertError) throw insertError
    return { ok: true }
  } catch {
    return checkMemory(key, limit, windowMs, now)
  }
}

/** Clear memory fallback buckets (tests). */
export function resetRateLimits(): void {
  buckets.clear()
}
