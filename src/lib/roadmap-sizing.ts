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

export type RoadmapSize = { lessons: number; phases: number; weeks: number; maxTokens: number }

/** Allow five minutes per planned weekly phase, with a 30-minute minimum. */
export function roadmapGenerationTimeoutMs(phases: number): number {
  const safePhases = Number.isFinite(phases) ? Math.max(1, Math.ceil(phases)) : 8
  return Math.max(30 * 60 * 1000, safePhases * 5 * 60 * 1000)
}

/** Match the lesson duration written to generated roadmap rows. */
export function estimateLessonMinutes(timeMins: number): number {
  const intensity = Math.max(0.5, Math.min(2, timeMins / 60))
  return Math.max(5, Math.min(20, Math.round(10 * intensity)))
}

/**
 * Size a roadmap from learner capacity. Weekly top-level (1 week = 1 phase)
 * so a 12-week goal yields 12 phases. Complete & uncapped: a 1-year goal
 * can be 260 lessons. Per-week pacing keeps each phase bounded for generation.
 */
export function planRoadmapSize(input: { timeMins?: number; durationDays?: number }): RoadmapSize {
  const durationDays =
    typeof input.durationDays === "number" && Number.isFinite(input.durationDays) && input.durationDays > 0
      ? input.durationDays
      : 56
  const weeks = Math.max(1, Math.ceil(durationDays / 7))
  // Keep a stable 7 lessons per phase; intensity affects depth, not lesson count.
  const lessons = Math.max(7, weeks * 7)
  const phases = weeks
  const maxTokens = Math.max(3000, Math.min(11000, lessons * 220))
  return { lessons, phases, weeks, maxTokens }
}

/**
 * Split a lesson count into sub-batches of at most `maxPerPart`, kept as
 * even as possible (remainder spread across parts). Sum always equals total;
 * total <= 0 yields []. Phase generation calls above ~5 lessons exceed the
 * ~50s per-step serverless budget, so large phases are generated in parts.
 */
export function splitCount(total: number, maxPerPart: number): number[] {
  const safe = Math.max(0, Math.floor(total))
  const cap = Math.max(1, Math.floor(maxPerPart))
  if (safe === 0) return []
  const parts = Math.ceil(safe / cap)
  const base = Math.floor(safe / parts)
  const remainder = safe % parts
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0))
}
