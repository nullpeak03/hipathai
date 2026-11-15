// Public pricing copy derived from the enforced rate limits.
//
// The page used to advertise "10 AI mentor prompts and 30 code runs per day"
// and "2 new AI roadmaps per month" while the only enforcement was per hour
// (60 prompts, 30 runs, 5 roadmaps). Generating the sentence from the same
// constants prevents the copy from drifting away from the product again.

export type EnforcedLimits = {
  roadmap: { limit: number; windowMs: number }
  tutor: { limit: number; windowMs: number }
  quiz: { limit: number; windowMs: number }
  code: { limit: number; windowMs: number }
}

const HOUR_MS = 60 * 60 * 1000

function windowLabel(windowMs: number): string {
  if (windowMs === HOUR_MS) return "hour"
  if (windowMs === 24 * HOUR_MS) return "day"
  if (windowMs === 30 * 24 * HOUR_MS) return "30 days"
  return `${Math.round(windowMs / HOUR_MS)} hours`
}

/**
 * One sentence listing the ceilings that are actually enforced. If a window
 * is ever changed from hourly, the wording follows automatically.
 */
export function fairUseSentence(limits: EnforcedLimits): string {
  const windows = new Set(
    [limits.roadmap, limits.tutor, limits.quiz, limits.code].map((entry) => windowLabel(entry.windowMs))
  )
  const per = windows.size === 1 ? [...windows][0] : null
  const parts = [
    `${limits.roadmap.limit} new AI roadmaps`,
    `${limits.tutor.limit} AI mentor prompts`,
    `${limits.quiz.limit} quizzes`,
    `${limits.code.limit} code runs`,
  ]
  const suffix = per ? ` per ${per}, per account.` : ", each within its own rolling window, per account."
  return `Current Free fair-use ceilings: ${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}${suffix}`
}
