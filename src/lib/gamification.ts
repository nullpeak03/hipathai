import type { Gamification } from "./store"

// Supabase gamification row <-> client Gamification mapping, shared by the
// me/activity + me/gamification API routes and store helpers.
export type GamificationRow = {
  xp: number | null
  level: number | null
  streak: number | null
  best_streak: number | null
  pass_rate: number | null
  study_minutes: number | null
  lessons_done: number | null
  last_study_date: string | null
}

export function toGamification(row: GamificationRow): Gamification {
  return {
    xp: row.xp ?? 0,
    level: row.level ?? 1,
    streak: row.streak ?? 0,
    bestStreak: row.best_streak ?? 0,
    passRate: row.pass_rate ?? 0,
    studyMinutes: row.study_minutes ?? 0,
    lessonsDone: row.lessons_done ?? 0,
    lastStudyDate: row.last_study_date ?? "",
  }
}

const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : fallback

/** Sanitize client-sent gamification into a DB row (server stamps the date). */
export function toGamificationRow(g: Partial<Record<string, unknown>>): Omit<GamificationRow, "last_study_date"> & { last_study_date: string } {
  return {
    xp: num(g.xp),
    level: Math.max(1, num(g.level, 1)),
    streak: num(g.streak),
    best_streak: num(g.bestStreak),
    pass_rate: num(g.passRate),
    study_minutes: num(g.studyMinutes),
    lessons_done: num(g.lessonsDone),
    last_study_date: new Date().toISOString().slice(0, 10),
  }
}

export function getLevel(xp: number) {  if (xp < 100) return 1
  if (xp < 300) return 2
  if (xp < 600) return 3
  if (xp < 1000) return 4
  if (xp < 1500) return 5
  return Math.floor((xp - 1500) / 800) + 6
}
export function xpForNextLevel(level: number) {
  const thresholds = [0, 100, 300, 600, 1000, 1500]
  if (level < thresholds.length) return thresholds[level]
  return 1500 + (level - 5) * 800
}
export function progressToNextLevel(xp: number) {
  const level = getLevel(xp)
  const currentThreshold = level === 1 ? 0 : xpForNextLevel(level - 1)
  const nextThreshold = xpForNextLevel(level)
  const progress = ((xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100
  return { level, nextThreshold, progress: Math.min(100, Math.max(0, progress)) }
}
