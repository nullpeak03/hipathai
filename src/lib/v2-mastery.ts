// V2 foundation: mastery contracts and helpers.

export const LESSON_PASS_THRESHOLD = 60
export const PHASE_EXAM_PASS_THRESHOLD = LESSON_PASS_THRESHOLD
export const V2_MASTERY_THRESHOLD = 90

export type MasteryRecord = {
  userId: string
  roadmapId: string | null
  lessonId: string | null
  topic: string
  masteryScore: number
  attempts: number
  lastPracticedAt: string | null
  decayRate: number
}

export type SkillNode = {
  id: string
  roadmapId: string
  lessonId: string | null
  topic: string
  difficulty: string | null
  prerequisites: string[]
}

export type ReplanProposal = {
  id: string
  roadmapId: string
  userId: string
  reason: string
  proposedChanges: Record<string, unknown>
  status: "pending" | "approved" | "rejected" | "applied"
  createdAt: string
  decidedAt: string | null
}

export function isMastered(masteryScore: number, analyticsBoost = 0): boolean {
  return masteryScore + analyticsBoost >= V2_MASTERY_THRESHOLD
}

export function decayedMastery(masteryScore: number, daysSincePractice: number, decayRate: number): number {
  const safeDays = Math.max(0, daysSincePractice)
  const safeRate = Math.max(0, Math.min(1, decayRate))
  return Math.max(0, Math.min(100, masteryScore * Math.exp(-safeRate * safeDays)))
}

export function masteryFromQuiz(score: number, attempts: number): number {
  const attemptPenalty = Math.max(0, (attempts - 1) * 3)
  return Math.max(0, Math.min(100, score - attemptPenalty))
}
