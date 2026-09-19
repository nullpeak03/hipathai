import { describe, it, expect } from "vitest"
import { isHttpUrl } from "./supabase/validate"
import { NimError, isRetriableStatus } from "./nvidia"

describe("isHttpUrl", () => {
  it("accepts http(s) URLs", () => {
    expect(isHttpUrl("https://xyz.supabase.co")).toBe(true)
    expect(isHttpUrl("http://localhost:54321")).toBe(true)
  })
  it("rejects pasted secrets, blobs, and empties", () => {
    expect(isHttpUrl("eyJhbGciOiJIUzI1NiJ9.payload")).toBe(false)
    expect(isHttpUrl('{"v":"v2","c":"..."}')).toBe(false)
    expect(isHttpUrl("")).toBe(false)
    expect(isHttpUrl(undefined)).toBe(false)
    expect(isHttpUrl("not a url")).toBe(false)
  })
})

describe("isRetriableStatus", () => {
  it("retries timeouts and server/rate errors", () => {
    expect(isRetriableStatus(undefined)).toBe(true)
    expect(isRetriableStatus(408)).toBe(true)
    expect(isRetriableStatus(429)).toBe(true)
    expect(isRetriableStatus(500)).toBe(true)
    expect(isRetriableStatus(503)).toBe(true)
  })
  it("fails fast on deterministic client errors", () => {
    for (const s of [400, 401, 403, 404, 410]) {
      expect(isRetriableStatus(s)).toBe(false)
    }
  })
})

describe("NimError", () => {
  it("carries the status", () => {
    const e = new NimError("HTTP 503 busy", 503)
    expect(e).toBeInstanceOf(Error)
    expect(e.status).toBe(503)
    expect(new NimError("boom").status).toBeUndefined()
  })
})
