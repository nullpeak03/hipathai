// Latency policy for lesson generation.
//
// The chain is four part calls in two waves (foundation, then examples /
// context / practice in parallel). Before this module, a slow provider could
// stack both waves (up to 200s), a missing-part repair wave (100s) and a
// quality regeneration (70s) into ~6 minutes of spinner before the learner
// saw anything.
//
// Budgeting is per attempt, not per job: Inngest retries start a fresh
// invocation, and starving a retry of time would turn a transient provider
// blip into a failed lesson. The job's total latency is still reported through
// `durationMs` in the job result.

export type LessonPartName = "foundation" | "examples" | "context" | "practice"

/** Wall-clock a single generation attempt may spend before shipping what it has. */
export const LESSON_ATTEMPT_BUDGET_MS = 240_000

/** Do not start optional remediation with less time than this left. */
export const MIN_REMEDIATION_MS = 55_000

/** Longest targeted single-part regeneration. */
export const REGEN_BUDGET_MS = 70_000

/** Above this score, a missing optional part is not worth another 100s call. */
export const GOOD_ENOUGH_SCORE = 85

/** Below this score, a complete lesson still gets its weakest part redone. */
export const QUALITY_FLOOR_SCORE = 70

/** Missing any of these leaves the lesson unusable, whatever the score says. */
export const ESSENTIAL_PARTS: readonly LessonPartName[] = ["foundation", "examples", "practice"]

export type PartState = { kind: LessonPartName; present: boolean; score: number }

export type RemediationPlan =
  | { kind: "none"; reason: "complete" | "good-enough" | "out-of-time" }
  | { kind: "repair"; parts: LessonPartName[] }
  | { kind: "regenerate"; part: LessonPartName }

/** Time left in this attempt's budget, never negative. */
export function remainingBudgetMs(
  startedAtMs: number,
  nowMs: number,
  budgetMs: number = LESSON_ATTEMPT_BUDGET_MS
): number {
  return Math.max(0, startedAtMs + budgetMs - nowMs)
}

/**
 * Decide the one remediation step worth running, if any.
 *
 * Exactly one mechanism per attempt: a missing part is repaired, or — when
 * every part is present — the weakest part is regenerated for quality. The old
 * chain could do both back to back, which is where most of the six minutes
 * went. A missing non-essential part on an already strong lesson is left alone.
 */
export function remediationPlan(input: {
  parts: readonly PartState[]
  score: number
  remainingMs: number
}): RemediationPlan {
  const { parts, score, remainingMs } = input
  if (parts.length === 0) return { kind: "none", reason: "complete" }

  const missing = parts.filter((part) => !part.present).map((part) => part.kind)
  const essentialMissing = missing.filter((kind) => ESSENTIAL_PARTS.includes(kind))
  const optionalMissing = missing.filter((kind) => !ESSENTIAL_PARTS.includes(kind))

  // Essential gaps always get a repair: a lesson without practice or examples
  // is not usable no matter how high the score on the remaining parts is.
  let target = essentialMissing
  if (target.length === 0 && optionalMissing.length > 0 && score < GOOD_ENOUGH_SCORE) {
    target = optionalMissing
  }

  if (target.length > 0) {
    if (remainingMs < MIN_REMEDIATION_MS) return { kind: "none", reason: "out-of-time" }
    return { kind: "repair", parts: target }
  }

  if (missing.length === 0 && score < QUALITY_FLOOR_SCORE) {
    if (remainingMs < MIN_REMEDIATION_MS) return { kind: "none", reason: "out-of-time" }
    const weakest = parts.reduce((low, part) => (part.score < low.score ? part : low), parts[0])
    return { kind: "regenerate", part: weakest.kind }
  }

  return { kind: "none", reason: optionalMissing.length > 0 ? "good-enough" : "complete" }
}

/** Log-friendly one-liner for the remediation decision. */
export function describePlan(plan: RemediationPlan): string {
  if (plan.kind === "repair") return `repair ${plan.parts.join("+")}`
  if (plan.kind === "regenerate") return `regenerate ${plan.part}`
  return `none (${plan.reason})`
}
