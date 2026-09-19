import { describe, it, expect } from "vitest"
import { buildRoadmapPrompt, ROADMAP_JSON_SYSTEM } from "./roadmap-prompt"

describe("buildRoadmapPrompt", () => {
  it("embeds the goal and calibration", () => {
    const p = buildRoadmapPrompt({ goal: "Rust", level: "Intermediate", time: "2 hrs", duration: "4 weeks", phases: 4, lessons: 20 })
    expect(p).toContain("Rust")
    expect(p).toContain("Intermediate")
    expect(p).toContain("2 hrs")
    expect(p).toContain("4 weeks")
  })
  it("interpolates the planned phase/lesson counts", () => {
    const p = buildRoadmapPrompt({ goal: "Go", phases: 5, lessons: 40 })
    expect(p).toContain("EXACTLY 5 phases")
    expect(p).toContain("~40 lessons")
    expect(p).toContain("Return ONLY valid JSON")
    expect(p).toContain("phases:[{title, lessons:[{title, objective}]}]")
    const small = buildRoadmapPrompt({ goal: "Go", phases: 2, lessons: 8 })
    expect(small).toContain("EXACTLY 2 phases")
    expect(small).toContain("~8 lessons")
  })
  it("applies defaults for level/time/duration", () => {
    const p = buildRoadmapPrompt({ goal: "Go", phases: 3, lessons: 12 })
    expect(p).toContain("Beginner")
    expect(p).toContain("1hr/day")
    expect(p).toContain("8 weeks")
  })
})

describe("ROADMAP_JSON_SYSTEM", () => {
  it("is a JSON-only instruction", () => {
    expect(ROADMAP_JSON_SYSTEM).toContain("ONLY valid JSON")
  })
})
