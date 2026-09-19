// Spaced-repetition scheduling (simplified expanding intervals).
// Pure logic, shared by the quiz-attempt API route and unit tests.

export const REVIEW_INTERVALS = [1, 3, 7, 14, 30]

export function addDays(base: string, n: number): string {
  const d = new Date(`${base}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export type ReviewState = {
  repetitions: number
  intervalDays: number
  nextReviewAt: string
  lastScore: number
}

/** State after a failed attempt: review tomorrow, streak reset. */
export function scheduleAfterFail(today: string, score: number): ReviewState {
  return { repetitions: 0, intervalDays: 1, nextReviewAt: addDays(today, 1), lastScore: score }
}

/** State after a passed attempt: advance through expanding intervals. */
export function scheduleAfterPass(today: string, score: number, prevRepetitions: number): ReviewState {
  const reps = Math.max(0, prevRepetitions) + 1
  const interval = REVIEW_INTERVALS[Math.min(reps, REVIEW_INTERVALS.length - 1)]
  return { repetitions: reps, intervalDays: interval, nextReviewAt: addDays(today, interval), lastScore: score }
}

/** Whole days from `from` until `to` (negative when overdue). */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000
  )
}
