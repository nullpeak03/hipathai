import type { ActivityDay } from "./store"

/**
 * Weekly goal defaults and helpers. The goal is a personal preference, so it
 * lives in localStorage instead of the database (no schema change needed).
 */
export const DEFAULT_WEEKLY_GOAL = 120
export const WEEKLY_GOAL_KEY = "hipath_weekly_goal_minutes"
const MIN_WEEKLY_GOAL = 15
const MAX_WEEKLY_GOAL = 10080

const DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "UTC",
})

export type DashboardDay = {
  key: string
  minutes: number
  lessons: number
  active: boolean
  weekday: string
  dayNum: number
  label: string
  isToday: boolean
  isFuture: boolean
}

/**
 * Activity is stamped by the server in UTC (`toISOString().slice(0, 10)`), so
 * every dashboard date calculation stays in UTC to avoid off-by-one days.
 */
function utcDateOnly(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function fromDayKey(key: string): Date {
  return new Date(`${key}T12:00:00.000Z`)
}

function toDashboardDay(key: string, row: ActivityDay | undefined, todayKey: string): DashboardDay {
  const date = fromDayKey(key)
  return {
    key,
    minutes: row?.minutes ?? 0,
    lessons: row?.lessons ?? 0,
    active: (row?.minutes ?? 0) > 0 || (row?.lessons ?? 0) > 0,
    weekday: WEEKDAY_FORMATTER.format(date),
    dayNum: date.getUTCDate(),
    label: DAY_FORMATTER.format(date),
    isToday: key === todayKey,
    isFuture: key > todayKey,
  }
}

/** The last `count` days, oldest first, including today. */
export function buildDaySeries(activity: ActivityDay[], count: number, now = new Date()): DashboardDay[] {
  const byDate = new Map(activity.map((day) => [day.date, day]))
  const end = utcDateOnly(now)
  const todayKey = toDayKey(end)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(end)
    date.setUTCDate(end.getUTCDate() - (count - 1 - index))
    const key = toDayKey(date)
    return toDashboardDay(key, byDate.get(key), todayKey)
  })
}

/** Four complete Monday-to-Sunday weeks ending with the current week. */
export function buildStreakCalendar(activity: ActivityDay[], now = new Date()): DashboardDay[] {
  const end = utcDateOnly(now)
  const mondayOffset = (end.getUTCDay() + 6) % 7
  const start = new Date(end)
  start.setUTCDate(end.getUTCDate() - mondayOffset - 21)
  const byDate = new Map(activity.map((day) => [day.date, day]))
  const todayKey = toDayKey(end)
  return Array.from({ length: 28 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    const key = toDayKey(date)
    return toDashboardDay(key, byDate.get(key), todayKey)
  })
}

export function sumMinutes(days: DashboardDay[]): number {
  return days.reduce((total, day) => total + day.minutes, 0)
}

export function activeDayCount(days: DashboardDay[]): number {
  return days.filter((day) => day.active).length
}

/** Minutes logged Monday through Sunday for the week containing `now`. */
export function weekToDate(activity: ActivityDay[], now = new Date()): number {
  const end = utcDateOnly(now)
  const mondayOffset = (end.getUTCDay() + 6) % 7
  const monday = new Date(end)
  monday.setUTCDate(end.getUTCDate() - mondayOffset)
  const byDate = new Map(activity.map((day) => [day.date, day.minutes]))
  let total = 0
  for (let index = 0; index < 7; index += 1) {
    const date = new Date(monday)
    date.setUTCDate(monday.getUTCDate() + index)
    total += byDate.get(toDayKey(date)) ?? 0
  }
  return total
}

export function heatLevel(minutes: number): 0 | 1 | 2 | 3 {
  if (minutes >= 30) return 3
  if (minutes >= 15) return 2
  if (minutes >= 1) return 1
  return 0
}

export function clampWeeklyGoal(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return DEFAULT_WEEKLY_GOAL
  return Math.min(MAX_WEEKLY_GOAL, Math.max(MIN_WEEKLY_GOAL, Math.round(parsed)))
}

export function loadWeeklyGoal(): number {
  if (typeof window === "undefined") return DEFAULT_WEEKLY_GOAL
  try {
    const raw = window.localStorage.getItem(WEEKLY_GOAL_KEY)
    return raw === null ? DEFAULT_WEEKLY_GOAL : clampWeeklyGoal(raw)
  } catch {
    return DEFAULT_WEEKLY_GOAL
  }
}

export function saveWeeklyGoal(minutes: number | string): number {
  const goal = clampWeeklyGoal(minutes)
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(WEEKLY_GOAL_KEY, String(goal))
    } catch {
      // Private mode/full storage: keep the in-memory goal for this session.
    }
  }
  return goal
}
