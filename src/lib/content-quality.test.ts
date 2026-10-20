import { describe, it, expect } from "vitest"
import { validateRoadmapShape, deduplicateByTitle, hasFinalCapstone } from "./content-quality"

describe("content quality", () => {
  it("flags empty roadmap", () => {
    expect(validateRoadmapShape(null)).toHaveLength(1)
  })

  it("flags duplicate lessons", () => {
    const issues = validateRoadmapShape({ phases: [{ title: "P1", lessons: [{ title: "L1" }, { title: "l1" }] }] })
    expect(issues.some((i) => i.code === "duplicate_lesson")).toBe(true)
  })

  it("deduplicates by title", () => {
    expect(deduplicateByTitle([{ title: "A" }, { title: "a" }, { title: "B" }])).toHaveLength(2)
  })
})

describe("final capstone", () => {
  it("detects a capstone in the final phase", () => {
    const spec = { phases: [{ lessons: [{ title: "Intro" }] }, { lessons: [{ title: "Final Capstone" }] }] }
    expect(hasFinalCapstone(spec)).toBe(true)
  })
  it("returns false when missing", () => {
    const spec = { phases: [{ lessons: [{ title: "Intro" }] }] }
    expect(hasFinalCapstone(spec)).toBe(false)
  })
})
