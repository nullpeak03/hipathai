// Per-user sliding-window rate limiting for AI endpoints.
// Primary store is Supabase (shared across serverless instances); an
// in-memory fallback covers tests, local dev, and DB outages.
// NOTE: call sites opt into fail-closed with the `failClosed` argument; the
// default keeps availability (allow the request) when the store is down.

import { createServerClient } from "./supabase/server"
import { getUnlimitedClerkId } from "./unlimited"
import { logWarn } from "./logger"

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
  code: { limit: 30, windowMs: HOUR_MS },
} as const

export type RateLimitKey = keyof typeof RATE_LIMITS

export type RateLimitResult = { ok: true } | { ok: false; retryAfterMs: number }

/** Postgres error code for "function not found in schema cache" (PostgREST). */
const MISSING_FUNCTION_CODE = "PGRST202"

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

/**
 * Parse the row returned by `consume_rate_limit`. PostgREST returns an array
 * for `returns table (...)`; a malformed payload is treated as an error so
 * the caller can fall back instead of silently allowing a burst through.
 */
export function parseConsumeResult(data: unknown): RateLimitResult | null {
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== "object") return null
  const { allowed, retry_after_ms: retryAfter } = row as {
    allowed?: unknown
    retry_after_ms?: unknown
  }
  if (typeof allowed !== "boolean") return null
  if (allowed) return { ok: true }
  const ms = typeof retryAfter === "number" && Number.isFinite(retryAfter) ? retryAfter : 0
  return { ok: false, retryAfterMs: Math.max(0, Math.ceil(ms)) }
}

/**
 * Legacy prune/count/insert path. Not atomic, but still correct for a single
 * request; only used until migration 026 is applied to the database.
 */
async function checkRateLimitLegacy(
  key: string,
  limit: number,
  windowMs: number,
  now: number
): Promise<RateLimitResult> {
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
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
  failClosed: boolean = false
): Promise<RateLimitResult> {
  // Unlimited account bypass.
  try {
    const unlimitedId = await getUnlimitedClerkId()
    if (unlimitedId && key.includes(unlimitedId)) return { ok: true }
  } catch {}
  // Unit tests must never touch the database.
  if (process.env.NODE_ENV === "test") {
    return checkMemory(key, limit, windowMs, now)
  }

  let result: RateLimitResult
  try {
    const supabase = createServerClient()
    // One statement: prune, count, then insert under a per-key advisory lock,
    // so concurrent requests cannot all read the same pre-limit count.
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_ms: windowMs,
      p_now: new Date(now).toISOString(),
    })
    if (error) {
      if (error.code === MISSING_FUNCTION_CODE) {
        result = await checkRateLimitLegacy(key, limit, windowMs, now)
      } else {
        throw error
      }
    } else {
      const parsed = parseConsumeResult(data)
      if (!parsed) throw new Error("consume_rate_limit returned an unusable row")
      result = parsed
    }
  } catch (e) {
    logWarn("rate_limit_store_error", {
      key,
      limit,
      windowMs,
      error: e instanceof Error ? e.message : String(e),
    })
    if (failClosed) {
      logWarn("rate_limit_fail_closed", { key, limit, windowMs })
      return { ok: false, retryAfterMs: windowMs }
    }
    return checkMemory(key, limit, windowMs, now)
  }

  if (!result.ok) logWarn("rate_limit_hit", { key, limit, windowMs })
  return result
}

/** Clear memory fallback buckets (tests). */
export function resetRateLimits(): void {
  buckets.clear()
}
