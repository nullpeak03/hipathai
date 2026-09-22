import { describe, it, expect } from "vitest"
import { parseStyles, buildStyleGuidance, STYLE_GUIDANCE } from "./style-guidance"

describe("parseStyles", () => {
  it("splits comma-joined strings", () => {
    expect(parseStyles("Visual, Hands-on")).toEqual(["Visual", "Hands-on"])
    expect(parseStyles("  Theory ,, Mixed ")).toEqual(["Theory", "Mixed"])
  })
  it("passes arrays through and handles empties", () => {
    expect(parseStyles(["Visual"])).toEqual(["Visual"])
    expect(parseStyles("")).toEqual([])
    expect(parseStyles(undefined)).toEqual([])
    expect(parseStyles(null)).toEqual([])
  })
})

describe("buildStyleGuidance", () => {
  it("renders one paragraph per known style", () => {
    const out = buildStyleGuidance("Visual, Hands-on")
    expect(out).toContain("- Visual:")
    expect(out).toContain("- Hands-on:")
    expect(out).toContain("analogies")
  })
  it("covers the new styles", () => {
    expect(STYLE_GUIDANCE["Project-Based"]).toBeTruthy()
    expect(STYLE_GUIDANCE["Socratic"]).toBeTruthy()
    expect(STYLE_GUIDANCE["Reading & Research"]).toBeTruthy()
    const out = buildStyleGuidance(["Project-Based", "Socratic", "Reading & Research"])
    expect(out).toContain("- Project-Based:")
    expect(out).toContain("- Socratic:")
    expect(out).toContain("- Reading & Research:")
  })
  it("dedupes, drops unknowns, and empties cleanly", () => {
    expect(buildStyleGuidance("Visual, Visual")).toBe(buildStyleGuidance("Visual"))
    expect(buildStyleGuidance("Nonsense")).toBe("")
    expect(buildStyleGuidance("")).toBe("")
    expect(buildStyleGuidance(undefined)).toBe("")
  })
})
