import { describe, it, expect } from "vitest"
import { parseTimeToMinutes, parseDurationToDays, planRoadmapSize } from "./roadmap-sizing"

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
  it("keeps the classic default at ~40 lessons / 5 phases", () => {
    expect(planRoadmapSize({ timeMins: 60, durationDays: 56 })).toEqual({
      lessons: 40, phases: 5, maxTokens: 8800,
    })
  })
  it("shrinks light plans to the floor", () => {
    expect(planRoadmapSize({ timeMins: 30, durationDays: 14 })).toMatchObject({
      lessons: 8, phases: 2,
    })
  })
  it("caps heavy plans", () => {
    expect(planRoadmapSize({ timeMins: 120, durationDays: 84 })).toMatchObject({
      lessons: 48, phases: 6,
    })
    expect(planRoadmapSize({ timeMins: 60, durationDays: 365 }).lessons).toBe(48)
  })
  it("scales mid-range plans and tokens with lessons", () => {
    const s = planRoadmapSize({ timeMins: 60, durationDays: 28 })
    expect(s).toEqual({ lessons: 20, phases: 3, maxTokens: 4400 })
  })
  it("falls back on garbage input", () => {
    expect(planRoadmapSize({})).toEqual({ lessons: 40, phases: 5, maxTokens: 8800 })
    expect(planRoadmapSize({ timeMins: -5, durationDays: NaN })).toEqual({
      lessons: 40, phases: 5, maxTokens: 8800,
    })
  })
})
