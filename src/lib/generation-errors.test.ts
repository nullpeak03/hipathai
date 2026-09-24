import { describe, it, expect } from "vitest"
import { isValidJobId, friendlyGenerationError, classifyJobError } from "./generation-errors"
import { ProviderError } from "./ai-errors"
import { NonRetriableError } from "inngest"

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
  it("maps quota/rate-limit errors to a calm retry message", () => {
    expect(friendlyGenerationError("HTTP 429 You exceeded your current quota, please check your plan and billing details.")).toMatch(/busier than usual/i)
    expect(friendlyGenerationError("generativelanguage.googleapis.com/generate_content_free_tier_requests limit: 20")).toMatch(/busier than usual/i)
  })
  it("maps mid-generation deletion to a recreate message", () => {
    expect(friendlyGenerationError('insert or update on table "phases" violates foreign key constraint "phases_roadmap_id_fkey"')).toMatch(/deleted while it was still generating/i)
    expect(friendlyGenerationError("Roadmap was deleted during generation — skipping remaining phases")).toMatch(/deleted while it was still generating/i)
  })
  it("passes short messages through and caps long garbage", () => {
    expect(friendlyGenerationError("Custom short error")).toBe("Custom short error")
    expect(friendlyGenerationError("x".repeat(500))).toMatch(/something went wrong/i)
    expect(friendlyGenerationError("")).toMatch(/something went wrong/i)
  })
})

describe("classifyJobError", () => {
  it("treats NonRetriableError as terminal", () => {
    const e = new NonRetriableError("Lesson not found or not owned")
    expect(classifyJobError(e).retriable).toBe(false)
  })
  it("treats 429/5xx provider faults as retriable", () => {
    expect(classifyJobError(new ProviderError("HTTP 429 slow down", 429)).retriable).toBe(true)
    expect(classifyJobError(new ProviderError("HTTP 503 overloaded", 503)).retriable).toBe(true)
    expect(classifyJobError(new ProviderError("HTTP 429 quota exceeded", 429)).friendly).toMatch(/busier than usual/i)
  })
  it("treats 4xx provider faults as terminal", () => {
    expect(classifyJobError(new ProviderError("HTTP 400 bad request", 400)).retriable).toBe(false)
    expect(classifyJobError(new ProviderError("HTTP 404 not found", 404)).retriable).toBe(false)
  })
  it("retries status-less network/timeout errors, not deterministic bugs", () => {
    expect(classifyJobError(new Error("Request failed: socket hang up")).retriable).toBe(true)
    expect(classifyJobError(new SyntaxError("Unexpected token 'x' in JSON")).retriable).toBe(false)
    expect(classifyJobError(new Error("Roadmap was deleted during generation")).retriable).toBe(false)
  })
})
