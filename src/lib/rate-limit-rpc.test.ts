import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// These tests exercise the database path, which is skipped when NODE_ENV is
// "test". Stub it to a production-like value and mock the client instead.
const rpc = vi.fn()
const legacyRows: { ts: string }[] = []

const builder = {
  delete: () => builder,
  lt: async () => ({ error: null }),
  select: () => builder,
  eq: () => builder,
  gt: () => builder,
  order: () => builder,
  limit: async () => ({ data: [...legacyRows], error: null }),
  insert: async () => ({ error: null }),
}

vi.mock("./supabase/server", () => ({
  createServerClient: () => ({ from: () => builder, rpc }),
}))
vi.mock("./unlimited", () => ({ getUnlimitedClerkId: async () => null }))
vi.mock("./logger", () => ({ logWarn: () => {} }))

const { checkRateLimit, resetRateLimits } = await import("./rate-limit")

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production")
  resetRateLimits()
  rpc.mockReset()
  legacyRows.length = 0
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("checkRateLimit atomic path", () => {
  it("consumes through the database function", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: true, retry_after_ms: 0 }], error: null })
    await expect(checkRateLimit("u1", 5, 1000, 1234)).resolves.toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      p_key: "u1",
      p_limit: 5,
      p_window_ms: 1000,
      p_now: new Date(1234).toISOString(),
    })
  })

  it("reports a denial from the function", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false, retry_after_ms: 250 }], error: null })
    await expect(checkRateLimit("u1", 1, 1000, 0)).resolves.toEqual({
      ok: false,
      retryAfterMs: 250,
    })
  })

  it("falls back to the legacy path while migration 026 is unapplied", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "not found" } })
    await expect(checkRateLimit("u1", 2, 1000, 0)).resolves.toEqual({ ok: true })

    legacyRows.push({ ts: new Date(0).toISOString() }, { ts: new Date(10).toISOString() })
    await expect(checkRateLimit("u1", 2, 1000, 20)).resolves.toEqual({
      ok: false,
      retryAfterMs: 980,
    })
  })

  it("uses the in-memory fallback for unexpected store errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "08006", message: "connection lost" } })
    await expect(checkRateLimit("u1", 1, 1000, 0)).resolves.toEqual({ ok: true })
    // The memory fallback recorded the first hit, so the second must block.
    await expect(checkRateLimit("u1", 1, 1000, 10)).resolves.toEqual({
      ok: false,
      retryAfterMs: 990,
    })
  })

  it("fails closed when asked and the store is unusable", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "08006", message: "connection lost" } })
    await expect(checkRateLimit("u1", 5, 1000, 0, true)).resolves.toEqual({
      ok: false,
      retryAfterMs: 1000,
    })
  })

  it("falls back when the function returns an unusable row", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: "maybe" }], error: null })
    await expect(checkRateLimit("u1", 1, 1000, 0)).resolves.toEqual({ ok: true })
  })
})
