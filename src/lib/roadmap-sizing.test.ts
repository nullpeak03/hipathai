import { describe, it, expect } from "vitest"
import { estimateLessonMinutes, parseTimeToMinutes, parseDurationToDays, planRoadmapSize } from "./roadmap-sizing"

describe("parseTimeToMinutes", () => {
  it("parses presets, customs, and decimals", () => {
    expect(parseTimeToMinutes("30 min")).toBe(30)
    expect(parseTimeToMinutes("90 min")).toBe(90)
    expect(parseTimeToMinutes("1 hr")).toBe(60)
    expect(parseTimeToMinutes("2 hrs")).toBe(120)
    expect(parseTimeToMinutes("3 hrs")).toBe(180)
    expect(parseTimeToMinutes("1.5 hours")).toBe(90)
    expect(parseTimeToMinutes("90")).toBe(90)
    expect(parseTimeToMinutes("banana")).toBe(60)
  })
})

describe("parseDurationToDays", () => {
  it("converts days, weeks, months, and years", () => {
    expect(parseDurationToDays("10 days")).toBe(10)
    expect(parseDurationToDays("2 weeks")).toBe(14)
    expect(parseDurationToDays("8 weeks")).toBe(56)
    expect(parseDurationToDays("3 months")).toBe(90)
    expect(parseDurationToDays("1 year")).toBe(365)
    expect(parseDurationToDays("Custom")).toBe(56)
  })
})

describe("planRoadmapSize", () => {
  it("keeps the classic default at ~56 lessons / 8 weeks (7 per week baseline)", () => {
    expect(planRoadmapSize({ timeMins: 60, durationDays: 56 })).toEqual({
      lessons: 56, phases: 8, weeks: 8, maxTokens: 11000,
    })
  })
  it("shrinks light plans to the floor", () => {
    expect(planRoadmapSize({ timeMins: 30, durationDays: 14 })).toMatchObject({
      lessons: 14, phases: 2, weeks: 2,
    })
  })
  it("scales uncapped for heavy plans", () => {
    expect(planRoadmapSize({ timeMins: 120, durationDays: 84 })).toMatchObject({
      lessons: 84, phases: 12, weeks: 12, maxTokens: 11000,
    })
    expect(planRoadmapSize({ timeMins: 60, durationDays: 365 })).toMatchObject({
      lessons: 371, phases: 53, weeks: 53,
    })
  })
  it("scales mid-range plans and tokens with lessons", () => {
    const s = planRoadmapSize({ timeMins: 60, durationDays: 28 })
    expect(s).toEqual({ lessons: 28, phases: 4, weeks: 4, maxTokens: 6160 })
  })
  it("falls back on garbage input", () => {
    expect(planRoadmapSize({})).toEqual({ lessons: 56, phases: 8, weeks: 8, maxTokens: 11000 })
    expect(planRoadmapSize({ timeMins: -5, durationDays: NaN })).toEqual({
      lessons: 56, phases: 8, weeks: 8, maxTokens: 11000,
    })
  })
})

describe("estimateLessonMinutes", () => {
  it("matches the generation estimate while keeping lesson lengths bounded", () => {
    expect(estimateLessonMinutes(30)).toBe(5)
    expect(estimateLessonMinutes(60)).toBe(10)
    expect(estimateLessonMinutes(120)).toBe(20)
    expect(estimateLessonMinutes(240)).toBe(20)
  })
})

describe("splitCount", () => {
  it("keeps small totals whole", async () => {
    const { splitCount } = await import("./roadmap-sizing")
    expect(splitCount(4, 5)).toEqual([4])
    expect(splitCount(5, 5)).toEqual([5])
    expect(splitCount(0, 5)).toEqual([])
    expect(splitCount(-3, 5)).toEqual([])
  })
  it("splits large totals into even parts within the cap", async () => {
    const { splitCount } = await import("./roadmap-sizing")
    expect(splitCount(7, 5)).toEqual([4, 3])
    expect(splitCount(14, 5)).toEqual([5, 5, 4])
    expect(splitCount(11, 5)).toEqual([4, 4, 3])
    const parts = splitCount(21, 5)
    expect(parts.every((p) => p <= 5)).toBe(true)
    expect(parts.reduce((a, b) => a + b, 0)).toBe(21)
  })
})
