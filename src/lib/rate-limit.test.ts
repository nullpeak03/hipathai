import { describe, it, expect, beforeEach } from "vitest"
import { checkRateLimit, resetRateLimits, RATE_LIMITS } from "./rate-limit"

beforeEach(() => {
  resetRateLimits()
})

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    expect(checkRateLimit("u1", 2, 1000, 0)).toEqual({ ok: true })
    expect(checkRateLimit("u1", 2, 1000, 10)).toEqual({ ok: true })
  })
  it("blocks over the limit with a retry delay", () => {
    checkRateLimit("u1", 2, 1000, 0)
    checkRateLimit("u1", 2, 1000, 10)
    const blocked = checkRateLimit("u1", 2, 1000, 20)
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) {
      expect(blocked.retryAfterMs).toBeGreaterThan(0)
      expect(blocked.retryAfterMs).toBeLessThanOrEqual(1000)
    }
  })
  it("slides the window (old hits expire)", () => {
    checkRateLimit("u1", 1, 100, 0)
    expect(checkRateLimit("u1", 1, 100, 50).ok).toBe(false)
    expect(checkRateLimit("u1", 1, 100, 101)).toEqual({ ok: true })
  })
  it("isolates keys from each other", () => {
    checkRateLimit("u1", 1, 1000, 0)
    expect(checkRateLimit("u2", 1, 1000, 0)).toEqual({ ok: true })
    expect(checkRateLimit("u1", 1, 1000, 0).ok).toBe(false)
  })
  it("defines sane tier budgets", () => {
    expect(RATE_LIMITS.roadmap.limit).toBeLessThanOrEqual(RATE_LIMITS.quiz.limit)
    expect(RATE_LIMITS.quiz.limit).toBeLessThanOrEqual(RATE_LIMITS.tutor.limit)
    for (const tier of Object.values(RATE_LIMITS)) {
      expect(tier.limit).toBeGreaterThan(0)
      expect(tier.windowMs).toBeGreaterThan(0)
    }
  })
})
