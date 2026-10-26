import { describe, expect, it } from "vitest"
import { isAllowedEvidenceUrl, isCapstoneTitle } from "./capstone-evidence"

describe("capstone evidence", () => {
  it("recognizes generated capstone project titles", () => {
    expect(isCapstoneTitle("Capstone: End-to-End Project")).toBe(true)
    expect(isCapstoneTitle("Final Project Presentation")).toBe(true)
    expect(isCapstoneTitle("Database Fundamentals")).toBe(false)
  })

  it("allows optional HTTP(S) links without embedded credentials", () => {
    expect(isAllowedEvidenceUrl("")).toBe(true)
    expect(isAllowedEvidenceUrl("https://github.com/example/project")).toBe(true)
    expect(isAllowedEvidenceUrl("http://localhost:3000")).toBe(true)
    expect(isAllowedEvidenceUrl("javascript:alert(1)")).toBe(false)
    expect(isAllowedEvidenceUrl("https://user:password@example.com")).toBe(false)
    expect(isAllowedEvidenceUrl("not a url")).toBe(false)
  })
})
