import { describe, it, expect } from "vitest"
import { buildWeaknessPrompt } from "./weakness-prompt"

describe("buildWeaknessPrompt", () => {
  it("embeds topic, score, and the recommendation contract", () => {
    const p = buildWeaknessPrompt({ topic: "Photosynthesis", score: 40, failCount: 1 })
    expect(p).toContain("Photosynthesis")
    expect(p).toContain("40%")
    expect(p).toContain("RECOMMENDATION:")
    expect(p).toContain("120 words")
  })
  it("adjusts tone for repeated failures", () => {
    expect(buildWeaknessPrompt({ topic: "T", score: 20, failCount: 3 })).toContain("3 times")
    expect(buildWeaknessPrompt({ topic: "T", score: 20, failCount: 1 })).not.toContain("times")
  })
})
