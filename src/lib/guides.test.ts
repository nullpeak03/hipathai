import { describe, it, expect } from "vitest"
import { readingMinutes, extractHeadings, listGuides, loadGuide, guidesForRoadmap } from "./guides"

describe("readingMinutes", () => {
  it("estimates at 200wpm with a floor of 1", () => {
    expect(readingMinutes("hello world")).toBe(1)
    expect(readingMinutes(Array(400).fill("word").join(" "))).toBe(2)
  })
})

describe("extractHeadings", () => {
  it("pulls h2/h3 with slug ids, skips h1", () => {
    expect(extractHeadings("# Title\n## How It Works?\n### Deep Dive!\ntext")).toEqual([
      { level: 2, text: "How It Works?", id: "how-it-works" },
      { level: 3, text: "Deep Dive!", id: "deep-dive" },
    ])
  })
})

describe("guides content", () => {
  it("ships valid guides with required frontmatter", () => {
    const guides = listGuides()
    expect(guides.length).toBeGreaterThanOrEqual(5)
    for (const g of guides) {
      expect(g.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(g.title.length).toBeGreaterThan(10)
      expect(g.description.length).toBeGreaterThan(40)
      expect(g.minutes).toBeGreaterThanOrEqual(2)
      const full = loadGuide(g.slug)
      expect(full).not.toBeNull()
      expect(full!.headings.length).toBeGreaterThanOrEqual(2)
      expect(full!.content.length).toBeGreaterThan(1500)
    }
  })
  it("every guide links at least one library topic", () => {
    for (const g of listGuides()) {
      expect(g.relatedSlugs.length, g.slug).toBeGreaterThan(0)
    }
  })
  it("guidesForRoadmap resolves backlinks", () => {
    const found = guidesForRoadmap("python-django-developer")
    expect(found.length).toBeGreaterThanOrEqual(1)
    expect(found.every((g) => g.relatedSlugs.includes("python-django-developer"))).toBe(true)
    expect(guidesForRoadmap("no-such-topic")).toEqual([])
  })
  it("rejects unknown slugs", () => {
    expect(loadGuide("../secret")).toBeNull()
    expect(loadGuide("")).toBeNull()
  })
})
