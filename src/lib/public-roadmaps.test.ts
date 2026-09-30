import { describe, it, expect } from "vitest"
import { slugifyTopic, isValidSyllabus, countSyllabusLessons } from "./public-roadmaps"

describe("slugifyTopic", () => {
  it("produces URL-safe slugs", () => {
    expect(slugifyTopic("Learn Python from Scratch!")).toBe("learn-python-from-scratch")
    expect(slugifyTopic("Data Structures & Algorithms")).toBe("data-structures-algorithms")
    expect(slugifyTopic("  AI Agents  ")).toBe("ai-agents")
    expect(slugifyTopic("!!!")).toBe("roadmap")
  })
})

describe("isValidSyllabus", () => {
  const good = { phases: [{ title: "P", lessons: [{ title: "L", objective: "O" }] }] }
  it("accepts well-formed syllabi", () => {
    expect(isValidSyllabus(good)).toBe(true)
  })
  it("rejects empty phases, empty lessons, and blank titles", () => {
    expect(isValidSyllabus({ phases: [] })).toBe(false)
    expect(isValidSyllabus({ phases: [{ title: "P", lessons: [] }] })).toBe(false)
    expect(isValidSyllabus({ phases: [{ title: "P", lessons: [{ title: "  " }] }] })).toBe(false)
    expect(isValidSyllabus(null)).toBe(false)
    expect(isValidSyllabus({})).toBe(false)
  })
})

describe("countSyllabusLessons", () => {
  it("sums lessons across phases", () => {
    expect(countSyllabusLessons({
      phases: [
        { title: "A", lessons: [{ title: "1", objective: "" }, { title: "2", objective: "" }] },
        { title: "B", lessons: [{ title: "3", objective: "" }] },
      ],
    })).toBe(3)
  })
})
