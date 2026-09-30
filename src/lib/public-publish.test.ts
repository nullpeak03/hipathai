import { describe, it, expect } from "vitest"
import { normalizeTopic, topicsMatch } from "./public-publish"

describe("normalizeTopic", () => {
  it("strips filler so variants share a key", () => {
    expect(normalizeTopic("Learn Python from Scratch")).toBe("python")
    expect(normalizeTopic("full python from beginning")).toBe("python")
    expect(normalizeTopic("Python")).toBe("python")
    expect(normalizeTopic("Data Structures & Algorithms")).toBe("data-structure-algorithm")
  })
  it("keeps intent-differentiating words", () => {
    expect(normalizeTopic("Data Structures & Algorithms for Career Switch")).toBe(
      "data-structure-algorithm-career-switch"
    )
    expect(normalizeTopic("!!!")).toBe("")
  })
})

describe("topicsMatch", () => {
  it("matches variants and reorderings", () => {
    expect(topicsMatch("Learn Python from Scratch", "full python from beginning")).toBe(true)
    expect(topicsMatch("Python Django Developer", "Django with Python")).toBe(true)
  })
  it("keeps distinct topics apart", () => {
    expect(topicsMatch("Data Structures & Algorithms", "Data Structures & Algorithms for Career Switch")).toBe(false)
    expect(topicsMatch("Python Django Developer", "Django REST APIs")).toBe(false)
    expect(topicsMatch("Trading", "Machine Learning")).toBe(false)
    expect(topicsMatch("", "Python")).toBe(false)
  })
})
