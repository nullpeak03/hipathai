import { describe, expect, it } from "vitest"
import {
  createWaitlistToken,
  hashWaitlistIp,
  hashWaitlistToken,
  normalizeWaitlistEmail,
} from "./pricing-waitlist"

describe("pricing waitlist helpers", () => {
  it("normalizes valid addresses and rejects malformed or oversized values", () => {
    expect(normalizeWaitlistEmail("  Learner@Example.COM ")).toBe("learner@example.com")
    expect(normalizeWaitlistEmail("not-an-email")).toBeNull()
    expect(normalizeWaitlistEmail("a@b.c")).toBe("a@b.c")
    expect(normalizeWaitlistEmail(`${"a".repeat(250)}@example.com`)).toBeNull()
    expect(normalizeWaitlistEmail(null)).toBeNull()
  })

  it("creates high-entropy URL-safe tokens and stores only their hashes", () => {
    const token = createWaitlistToken()
    expect(token).toMatch(/^[a-f0-9]{64}$/)
    expect(hashWaitlistToken(token)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashWaitlistToken(token)).not.toBe(token)
    expect(hashWaitlistToken(token)).toBe(hashWaitlistToken(token))
  })

  it("hashes IP values before they are used in rate-limit keys", () => {
    expect(hashWaitlistIp("203.0.113.1")).toMatch(/^[a-f0-9]{32}$/)
    expect(hashWaitlistIp("203.0.113.1")).toBe(hashWaitlistIp("203.0.113.1"))
    expect(hashWaitlistIp("203.0.113.1")).not.toBe("203.0.113.1")
  })
})
