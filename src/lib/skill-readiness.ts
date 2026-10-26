export type SkillReadinessStatus =
  | "not_assessed"
  | "learning"
  | "practicing"
  | "demonstrated"
  | "needs_review"

export type SkillQuizEvidence = {
  score: number
  createdAt: string
}

export type SkillReadinessInput = {
  quizAttempts: SkillQuizEvidence[]
  successfulQuickChecks: number
  capstoneReported: boolean
  lessonIsCurrent: boolean
  reviewOverdue: boolean
  now?: Date
}

export type SkillReadinessResult = {
  status: SkillReadinessStatus
  score: number | null
  explanation: string
}

const QUIZ_RECENCY_HALF_LIFE_DAYS = 30
const DEMONSTRATED_THRESHOLD = 90

export function recencyWeightedScore(attempts: SkillQuizEvidence[], now = new Date()): number | null {
  if (attempts.length === 0) return null
  let weightedTotal = 0
  let totalWeight = 0
  for (const attempt of attempts) {
    if (!Number.isFinite(attempt.score) || attempt.score < 0 || attempt.score > 100) continue
    const ageDays = Math.max(0, (now.getTime() - Date.parse(attempt.createdAt)) / 86_400_000)
    const weight = Number.isFinite(ageDays)
      ? Math.pow(0.5, ageDays / QUIZ_RECENCY_HALF_LIFE_DAYS)
      : 0
    weightedTotal += attempt.score * weight
    totalWeight += weight
  }
  return totalWeight > 0 ? Math.round(weightedTotal / totalWeight) : null
}

export function calculateSkillReadiness(input: SkillReadinessInput): SkillReadinessResult {
  const now = input.now ?? new Date()
  const score = recencyWeightedScore(input.quizAttempts, now)
  const latestAttempt = [...input.quizAttempts]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
  const previouslyStrong = input.quizAttempts.some((attempt) => attempt.score >= DEMONSTRATED_THRESHOLD)

  if (input.reviewOverdue || (previouslyStrong && latestAttempt !== undefined && latestAttempt.score < 60)) {
    return {
      status: "needs_review",
      score,
      explanation: input.reviewOverdue
        ? "A scheduled review is overdue for this skill."
        : "A recent assessment shows this skill may need refreshing.",
    }
  }

  if (score === null) {
    return input.lessonIsCurrent
      ? { status: "learning", score: null, explanation: "This is the next skill in your roadmap; assessment evidence is not available yet." }
      : { status: "not_assessed", score: null, explanation: "No assessment evidence has been recorded for this skill yet." }
  }

  if (score >= DEMONSTRATED_THRESHOLD && input.successfulQuickChecks > 0) {
    return {
      status: "demonstrated",
      score,
      explanation: `Recent-weighted quiz performance is ${score}%, supported by ${input.successfulQuickChecks} successful quick check${input.successfulQuickChecks === 1 ? "" : "s"}.`,
    }
  }

  const support = input.capstoneReported
    ? " Capstone notes are learner-reported and have not been independently verified."
    : ""
  return {
    status: "practicing",
    score,
    explanation: score >= DEMONSTRATED_THRESHOLD
      ? `Quiz performance is ${score}%; complete a mapped quick check to add corroborating evidence.${support}`
      : `Recent-weighted quiz performance is ${score}%; keep practicing and review the explanations.${support}`,
  }
}
