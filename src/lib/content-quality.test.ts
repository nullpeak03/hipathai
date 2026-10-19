import { describe, it, expect } from "vitest"
import { validateRoadmapShape, deduplicateByTitle } from "./content-quality"

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
