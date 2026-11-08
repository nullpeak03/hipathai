import { describe, expect, it } from "vitest"
import {
  activeDayCount,
  buildDaySeries,
  buildStreakCalendar,
  clampWeeklyGoal,
  DEFAULT_WEEKLY_GOAL,
  heatLevel,
  saveWeeklyGoal,
  sumMinutes,
  weekToDate,
} from "./dashboard"
import type { ActivityDay } from "./store"

const SUNDAY = new Date("2026-11-08T12:00:00.000Z")
const WEDNESDAY = new Date("2026-11-04T12:00:00.000Z")

const activity: ActivityDay[] = [
  { date: "2026-11-08", minutes: 20, xp: 10, lessons: 1 },
  { date: "2026-11-02", minutes: 30, xp: 20, lessons: 2 },
  { date: "2026-11-01", minutes: 40, xp: 30, lessons: 1 },
  { date: "2026-10-26", minutes: 15, xp: 5, lessons: 1 },
]

describe("buildDaySeries", () => {
  it("builds the requested window oldest-first, ending today", () => {
    const days = buildDaySeries(activity, 14, SUNDAY)

    expect(days).toHaveLength(14)
    expect(days[0].key).toBe("2026-10-26")
    expect(days[13].key).toBe("2026-11-08")
    expect(days[13].isToday).toBe(true)
    expect(days.filter((day) => day.isToday)).toHaveLength(1)
  })

  it("fills days without activity as inactive", () => {
    const days = buildDaySeries(activity, 14, SUNDAY)
    const empty = days.find((day) => day.key === "2026-10-27")

    expect(empty).toMatchObject({ minutes: 0, lessons: 0, active: false })
    expect(sumMinutes(days)).toBe(105)
    expect(activeDayCount(days)).toBe(4)
  })
})

describe("weekToDate", () => {
  it("sums Monday through Sunday for the current UTC week", () => {
    expect(weekToDate(activity, SUNDAY)).toBe(50)
  })
})

describe("buildStreakCalendar", () => {
  it("returns four complete Monday-to-Sunday weeks", () => {
    const days = buildStreakCalendar(activity, SUNDAY)

    expect(days).toHaveLength(28)
    expect(days[0].key).toBe("2026-10-12")
    expect(days[0].weekday).toBe("Mon")
    expect(days[27].key).toBe("2026-11-08")
    expect(days.filter((day) => day.isFuture)).toHaveLength(0)
  })

  it("marks the remaining days of the current week as future", () => {
    const days = buildStreakCalendar(activity, WEDNESDAY)

    expect(days.filter((day) => day.isFuture)).toHaveLength(4)
    expect(days.find((day) => day.isToday)?.key).toBe("2026-11-04")
  })
})

describe("heatLevel", () => {
  it("maps minutes to four heat buckets", () => {
    expect(heatLevel(0)).toBe(0)
    expect(heatLevel(1)).toBe(1)
    expect(heatLevel(14)).toBe(1)
    expect(heatLevel(15)).toBe(2)
    expect(heatLevel(29)).toBe(2)
    expect(heatLevel(30)).toBe(3)
  })
})

describe("weekly goal", () => {
  it("clamps to a sane range and falls back to the default", () => {
    expect(clampWeeklyGoal("nope")).toBe(DEFAULT_WEEKLY_GOAL)
    expect(clampWeeklyGoal(0)).toBe(15)
    expect(clampWeeklyGoal(180)).toBe(180)
    expect(clampWeeklyGoal(99_999)).toBe(10_080)
  })

  it("returns the persisted value it would store", () => {
    expect(saveWeeklyGoal("150")).toBe(150)
  })
})
