import { describe, expect, it } from "vitest"
import { validateRoadmapInput } from "./roadmap-input"

describe("validateRoadmapInput", () => {
  it("keeps historical defaults for an empty body", () => {
    const result = validateRoadmapInput({})
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      goal: "AI Agent Developer",
      level: "Beginner",
      timeMins: 60,
      durationDays: 56,
    })
  })

  it("normalizes a valid custom plan", () => {
    const result = validateRoadmapInput({
      goal: "  Become a data engineer  ",
      level: "Intermediate",
      time: "90 min",
      duration: "6 weeks",
      why: "Career switch",
      style: "Hands-on",
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({
      goal: "Become a data engineer",
      timeMins: 90,
      durationDays: 42,
      style: "Hands-on",
    })
  })

  it("accepts the boundary values", () => {
    for (const [duration, days] of [
      ["1 week", 7],
      ["1 year", 365],
    ] as const) {
      const result = validateRoadmapInput({ duration })
      expect(result.ok, duration).toBe(true)
      if (result.ok) expect(result.value.durationDays).toBe(days)
    }
    for (const [time, mins] of [
      ["15 min", 15],
      ["8 hrs", 480],
    ] as const) {
      const result = validateRoadmapInput({ time })
      expect(result.ok, time).toBe(true)
      if (result.ok) expect(result.value.timeMins).toBe(mins)
    }
  })

  it("rejects absurd plan lengths instead of scheduling millions of phases", () => {
    // Regression: durationDays was unbounded, so this reached Inngest and
    // planned ~5.2M phases / ~10M model calls.
    for (const duration of ["100000 years", "2 years", "53 weeks", "366 days", "0 days"]) {
      const result = validateRoadmapInput({ duration })
      expect(result.ok, duration).toBe(false)
    }
  })

  it("rejects unparseable or out-of-range study time", () => {
    for (const time of ["banana", "0 min", "14 min", "9 hrs", "500 min"]) {
      const result = validateRoadmapInput({ time })
      expect(result.ok, time).toBe(false)
    }
  })

  it("rejects missing numbers in custom text", () => {
    expect(validateRoadmapInput({ duration: "soon" }).ok).toBe(false)
    expect(validateRoadmapInput({ time: "a lot" }).ok).toBe(false)
  })

  it("rejects invalid types and oversized fields", () => {
    expect(validateRoadmapInput(null).ok).toBe(false)
    expect(validateRoadmapInput([]).ok).toBe(false)
    expect(validateRoadmapInput("string").ok).toBe(false)
    expect(validateRoadmapInput({ goal: 42 }).ok).toBe(false)
    expect(validateRoadmapInput({ goal: "ab" }).ok).toBe(false)
    expect(validateRoadmapInput({ goal: "x".repeat(121) }).ok).toBe(false)
    expect(validateRoadmapInput({ level: "x".repeat(81) }).ok).toBe(false)
    expect(validateRoadmapInput({ why: "x".repeat(121) }).ok).toBe(false)
  })

  it("returns a user-facing error message", () => {
    const result = validateRoadmapInput({ duration: "2 years" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/between 1 week and 1 year/i)
  })
})
