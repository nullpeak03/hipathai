import { describe, it, expect } from "vitest"
import { buildRoadmapPrompt, buildOutlinePrompt, buildPhasePrompt, distributeLessons, ROADMAP_JSON_SYSTEM } from "./roadmap-prompt"

describe("buildRoadmapPrompt", () => {
  it("embeds the goal and calibration", () => {
    const p = buildRoadmapPrompt({ goal: "Rust", level: "Intermediate", time: "2 hrs", duration: "4 weeks", phases: 4, lessons: 20 })
    expect(p).toContain("Rust")
    expect(p).toContain("Intermediate")
    expect(p).toContain("2 hrs")
    expect(p).toContain("4 weeks")
  })
  it("adds motivation only when provided", () => {
    const withWhy = buildRoadmapPrompt({ goal: "Go", phases: 5, lessons: 40, why: "Get promoted" })
    expect(withWhy).toContain("Motivation: Get promoted")
    const withoutWhy = buildRoadmapPrompt({ goal: "Go", phases: 5, lessons: 40 })
    expect(withoutWhy).not.toContain("Motivation:")
    const blankWhy = buildRoadmapPrompt({ goal: "Go", phases: 5, lessons: 40, why: "   " })
    expect(blankWhy).not.toContain("Motivation:")
  })
  it("delegates titles and counts to Nemotron 3 Ultra with sizing hint", () => {
    const p = buildRoadmapPrompt({ goal: "Go", phases: 5, lessons: 40 })
    expect(p).toContain("You are Nemotron 3 Ultra")
    expect(p).toContain("You decide all phase and lesson titles")
    expect(p).toContain("You decide how many lessons per phase")
    expect(p).toContain("Sizing hint")
    expect(p).toContain("about 5 phases and ~40 lessons")
    expect(p).not.toContain("Week 1 to Week 5")
    expect(p).not.toContain("Python Foundations")
    expect(p).not.toContain("Python Syntax")
    expect(p).toContain("Return ONLY valid JSON")
    expect(p).toContain("phases:[{title, lessons:[{title, objective}]}]")
    const small = buildRoadmapPrompt({ goal: "Go", phases: 2, lessons: 8 })
    expect(small).toContain("about 2 phases and ~8 lessons")
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

describe("distributeLessons", () => {
  it("splits evenly", () => {
    expect(distributeLessons(40, 5)).toEqual([8, 8, 8, 8, 8])
  })
  it("gives the remainder to the earliest phases", () => {
    expect(distributeLessons(41, 5)).toEqual([9, 8, 8, 8, 8])
    expect(distributeLessons(8, 3)).toEqual([3, 3, 2])
  })
  it("always sums to the total", () => {
    for (const [total, phases] of [[1, 1], [7, 4], [48, 6], [0, 3]] as const) {
      const parts = distributeLessons(total, phases)
      expect(parts).toHaveLength(phases)
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
    }
  })
  it("handles degenerate input", () => {
    expect(distributeLessons(10, 0)).toEqual([])
    expect(distributeLessons(-5, 3)).toEqual([0, 0, 0])
  })
})

describe("buildOutlinePrompt", () => {
  it("asks Ultra for titles with sizing hint", () => {
    const p = buildOutlinePrompt({ goal: "Rust", level: "Beginner", phases: 4 })
    expect(p).toContain("Rust")
    expect(p).toContain("You are Nemotron 3 Ultra")
    expect(p).toContain("You decide all phase titles")
    expect(p).toContain("about 4 phases")
    expect(p).not.toContain("Week 1 to Week 4")
    expect(p).not.toContain("concept phrases like")
    expect(p).toContain("{title, description, phases:[{title}]}")
    expect(p).not.toContain("objective")
  })
  it("adds motivation only when provided", () => {
    expect(buildOutlinePrompt({ goal: "Go", phases: 3, why: "Career switch" })).toContain("Motivation: Career switch")
    expect(buildOutlinePrompt({ goal: "Go", phases: 3 })).not.toContain("Motivation:")
  })
})

describe("buildPhasePrompt", () => {
  it("delegates lesson titles and counts to Ultra for one phase", () => {
    const p = buildPhasePrompt({ goal: "Go", phaseIndex: 2, phaseCount: 5, phaseTitle: "Concurrency", lessonCount: 8 })
    expect(p).toContain("You are Nemotron 3 Ultra")
    expect(p).toContain('phase 2 of 5')
    expect(p).not.toContain('Week 2 of 5')
    expect(p).toContain('"Concurrency"')
    expect(p).toContain("You decide all lesson titles and objectives")
    expect(p).toContain("about 8 lessons")
    expect(p).not.toContain("EXACTLY 8 lessons")
    expect(p).not.toContain('"Python Syntax"')
    expect(p).toContain("{title, lessons:[{title, objective}]}")
  })
  it("adds motivation only when provided", () => {
    expect(buildPhasePrompt({ goal: "Go", phaseIndex: 1, phaseCount: 2, phaseTitle: "Basics", lessonCount: 4, why: "Exam" })).toContain("Motivation: Exam")
    expect(buildPhasePrompt({ goal: "Go", phaseIndex: 1, phaseCount: 2, phaseTitle: "Basics", lessonCount: 4 })).not.toContain("Motivation:")
  })
})

describe("style blending in roadmap prompts", () => {
  it("appends guidance for outline and phase prompts", async () => {
    const { buildOutlinePrompt, buildPhasePrompt } = await import("./roadmap-prompt")
    const outline = buildOutlinePrompt({ goal: "Go", phases: 3, styles: "Project-Based" })
    expect(outline).toContain("Shape the roadmap")
    expect(outline).toContain("working artifact")
    const phase = buildPhasePrompt({
      goal: "Go", phaseIndex: 1, phaseCount: 3,
      phaseTitle: "Basics", lessonCount: 4, styles: ["Theory", "Nope"],
    })
    expect(phase).toContain("- Theory:")
    expect(phase).not.toContain("Nope")
    const plain = buildPhasePrompt({
      goal: "Go", phaseIndex: 1, phaseCount: 3, phaseTitle: "Basics", lessonCount: 4,
    })
    expect(plain).not.toContain("Shape the roadmap")
  })
})
