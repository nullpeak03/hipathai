import { describe, it, expect } from "vitest"
import { addDays, nextReviewState, scheduleAfterFail, scheduleAfterPass, daysBetween } from "./review"

describe("addDays", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01")
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01")
    expect(addDays("2026-09-19", 0)).toBe("2026-09-19")
  })
})

describe("scheduleAfterFail", () => {
  it("reviews tomorrow with a reset streak", () => {
    expect(scheduleAfterFail("2026-09-19", 40)).toEqual({
      repetitions: 0, intervalDays: 1, nextReviewAt: "2026-09-20", lastScore: 40,
    })
  })
})

describe("scheduleAfterPass", () => {
  it("advances through expanding intervals", () => {
    expect(scheduleAfterPass("2026-09-19", 80, 0)).toMatchObject({ repetitions: 1, intervalDays: 3, nextReviewAt: "2026-09-22" })
    expect(scheduleAfterPass("2026-09-19", 80, 1)).toMatchObject({ repetitions: 2, intervalDays: 7, nextReviewAt: "2026-09-26" })
    expect(scheduleAfterPass("2026-09-19", 80, 2)).toMatchObject({ repetitions: 3, intervalDays: 14, nextReviewAt: "2026-10-03" })
    expect(scheduleAfterPass("2026-09-19", 80, 3)).toMatchObject({ repetitions: 4, intervalDays: 30, nextReviewAt: "2026-10-19" })
  })
  it("caps at 30 days and tolerates bad input", () => {
    expect(scheduleAfterPass("2026-09-19", 80, 99).intervalDays).toBe(30)
    expect(scheduleAfterPass("2026-09-19", 80, -2).repetitions).toBe(1)
  })
})

describe("daysBetween", () => {
  it("counts whole days with sign", () => {
    expect(daysBetween("2026-09-19", "2026-09-19")).toBe(0)
    expect(daysBetween("2026-09-18", "2026-09-19")).toBe(1)
    expect(daysBetween("2026-09-19", "2026-09-18")).toBe(-1)
  })
})

describe("nextReviewState", () => {
  it("schedules the first review after a first-time pass", () => {
    // Regression: the submit route only updated an existing row, so a learner
    // who passed on the first attempt never entered spaced repetition.
    expect(nextReviewState({ passed: true, today: "2026-09-19", score: 80 })).toEqual({
      repetitions: 1,
      intervalDays: 3,
      nextReviewAt: "2026-09-22",
      lastScore: 80,
    })
  })

  it("advances an existing schedule on later passes", () => {
    expect(
      nextReviewState({ passed: true, today: "2026-09-19", score: 95, previousRepetitions: 2 })
    ).toMatchObject({ repetitions: 3, intervalDays: 14 })
  })

  it("resets to tomorrow on a fail", () => {
    expect(
      nextReviewState({ passed: false, today: "2026-09-19", score: 40, previousRepetitions: 4 })
    ).toEqual({
      repetitions: 0,
      intervalDays: 1,
      nextReviewAt: "2026-09-20",
      lastScore: 40,
    })
  })
})
