import { describe, it, expect } from "vitest"
import { isValidJobId, friendlyGenerationError } from "./generation-errors"

describe("isValidJobId", () => {
  it("accepts UUIDs", () => {
    expect(isValidJobId("123e4567-e89b-12d3-a456-426614174000")).toBe(true)
    expect(isValidJobId("ABCDEF12-ABCD-ABCD-ABCD-ABCDEF123456")).toBe(true)
  })
  it("rejects non-UUIDs", () => {
    expect(isValidJobId("final-fallback-test-1789805063")).toBe(false)
    expect(isValidJobId("")).toBe(false)
    expect(isValidJobId("123e4567-e89b-12d3-a456")).toBe(false)
    expect(isValidJobId(42)).toBe(false)
    expect(isValidJobId(null)).toBe(false)
    expect(isValidJobId(undefined)).toBe(false)
  })
})

describe("friendlyGenerationError", () => {
  it("maps tracking errors", () => {
    expect(friendlyGenerationError('invalid input syntax for type uuid: "abc"')).toMatch(/tracking error/i)
  })
  it("maps missing-account FK failures", () => {
    expect(friendlyGenerationError('insert or update on table "roadmaps" violates foreign key constraint "roadmaps_user_id_fkey"')).toMatch(/sign out and sign in again/i)
  })
  it("maps AI outages", () => {
    expect(friendlyGenerationError("ALL_MODELS_FAILED")).toMatch(/temporarily unavailable/i)
    expect(friendlyGenerationError("NIM model timeout")).toMatch(/temporarily unavailable/i)
  })
  it("maps connectivity problems", () => {
    expect(friendlyGenerationError("Failed to fetch")).toMatch(/connection/i)
    expect(friendlyGenerationError("PGRST116")).toMatch(/connection|servers/i)
  })
  it("maps timeouts and expired sessions", () => {
    expect(friendlyGenerationError("Generation timed out. Please try again.")).toMatch(/longer than usual/i)
    expect(friendlyGenerationError("Unauthorized 401")).toMatch(/sign in again/i)
  })
  it("passes short messages through and caps long garbage", () => {
    expect(friendlyGenerationError("Custom short error")).toBe("Custom short error")
    expect(friendlyGenerationError("x".repeat(500))).toMatch(/something went wrong/i)
    expect(friendlyGenerationError("")).toMatch(/something went wrong/i)
  })
})
