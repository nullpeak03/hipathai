// Roadmap sizing: derive phase/lesson counts from onboarding inputs instead
// of a fixed 5-phase/40-lesson template. Canonical time/duration parsers live
// here (single source — the async route's inline duplicates were removed).

/** "30 min" → 30, "1 hr" / "2 hrs" → 60/120, bare numbers as-is, else 60. */
export function parseTimeToMinutes(time: string): number {
  const t = time.toLowerCase().trim()
  const hr = t.match(/(\d+(?:\.\d+)?)\s*(hr|hour)/)
  if (hr) return Math.round(parseFloat(hr[1]) * 60)
  const min = t.match(/(\d+)\s*min/)
  if (min) return parseInt(min[1], 10)
  const bare = parseInt(t, 10)
  return isNaN(bare) ? 60 : bare
}

/** "2 weeks" → 14, "3 months" → 90, "1 year" → 365, "10 days" → 10, else 56. */
export function parseDurationToDays(duration: string): number {
  const d = duration.toLowerCase().trim()
  const n = parseInt(d, 10)
  if (isNaN(n)) return 56
  if (d.includes("year")) return n * 365
  if (d.includes("month")) return n * 30
  if (d.includes("week")) return n * 7
  if (d.includes("day")) return n
  return 56
}

export type RoadmapSize = { lessons: number; phases: number; maxTokens: number }

/**
 * Size a roadmap from learner capacity. Calibrated so the classic default
 * (8 weeks, 1 hr/day) still yields ~40 lessons / 5 phases:
 * lessons = weeks × 5 × intensity, intensity = daily minutes normalized
 * to an hour, clamped so light plans stay viable and heavy plans stay
 * generatable within timeout/token budgets.
 */
export function planRoadmapSize(input: { timeMins?: number; durationDays?: number }): RoadmapSize {
  const timeMins =
    typeof input.timeMins === "number" && Number.isFinite(input.timeMins) && input.timeMins > 0
      ? input.timeMins
      : 60
  const durationDays =
    typeof input.durationDays === "number" && Number.isFinite(input.durationDays) && input.durationDays > 0
      ? input.durationDays
      : 56
  const weeks = durationDays / 7
  const intensity = Math.max(0.5, Math.min(2, timeMins / 60))
  const lessons = Math.max(8, Math.min(48, Math.round(weeks * 5 * intensity)))
  const phases = Math.max(2, Math.min(6, Math.round(lessons / 8)))
  const maxTokens = Math.max(3000, Math.min(11000, lessons * 220))
  return { lessons, phases, maxTokens }
}
