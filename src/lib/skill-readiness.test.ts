import { describe, expect, it } from "vitest"
import { calculateSkillReadiness, recencyWeightedScore } from "./skill-readiness"

const now = new Date("2026-10-26T00:00:00Z")

describe("recencyWeightedScore", () => {
  it("weights recent performance more heavily than old results", () => {
    const score = recencyWeightedScore([
      { score: 50, createdAt: "2026-08-27T00:00:00Z" },
      { score: 100, createdAt: "2026-10-26T00:00:00Z" },
    ], now)
    expect(score).toBeGreaterThan(80)
  })

  it("returns null when there is no valid evidence", () => {
    expect(recencyWeightedScore([], now)).toBeNull()
    expect(recencyWeightedScore([{ score: 101, createdAt: now.toISOString() }], now)).toBeNull()
  })
})

describe("calculateSkillReadiness", () => {
  it("does not label quiz-only performance as demonstrated", () => {
    const result = calculateSkillReadiness({
      quizAttempts: [{ score: 95, createdAt: now.toISOString() }],
      successfulQuickChecks: 0,
      capstoneReported: false,
      lessonIsCurrent: false,
      reviewOverdue: false,
      now,
    })
    expect(result.status).toBe("practicing")
  })

  it("requires strong quiz performance and corroborating quick-check evidence", () => {
    const result = calculateSkillReadiness({
      quizAttempts: [{ score: 95, createdAt: now.toISOString() }],
      successfulQuickChecks: 1,
      capstoneReported: false,
      lessonIsCurrent: false,
      reviewOverdue: false,
      now,
    })
    expect(result.status).toBe("demonstrated")
    expect(result.score).toBe(95)
  })

  it("marks a previously strong skill for review after a poor later attempt", () => {
    const result = calculateSkillReadiness({
      quizAttempts: [
        { score: 95, createdAt: "2026-10-01T00:00:00Z" },
        { score: 50, createdAt: now.toISOString() },
      ],
      successfulQuickChecks: 1,
      capstoneReported: false,
      lessonIsCurrent: false,
      reviewOverdue: false,
      now,
    })
    expect(result.status).toBe("needs_review")
  })

  it("marks a skill for review when its scheduled review is overdue", () => {
    const result = calculateSkillReadiness({
      quizAttempts: [{ score: 70, createdAt: now.toISOString() }],
      successfulQuickChecks: 0,
      capstoneReported: false,
      lessonIsCurrent: false,
      reviewOverdue: true,
      now,
    })
    expect(result.status).toBe("needs_review")
  })

  it("labels an unassessed current lesson as learning", () => {
    const result = calculateSkillReadiness({
      quizAttempts: [],
      successfulQuickChecks: 0,
      capstoneReported: false,
      lessonIsCurrent: true,
      reviewOverdue: false,
      now,
    })
    expect(result.status).toBe("learning")
  })

  it("labels learner-entered capstone evidence as unverified context", () => {
    const result = calculateSkillReadiness({
      quizAttempts: [{ score: 70, createdAt: now.toISOString() }],
      successfulQuickChecks: 0,
      capstoneReported: true,
      lessonIsCurrent: false,
      reviewOverdue: false,
      now,
    })
    expect(result.explanation).toContain("learner-reported")
    expect(result.explanation).toContain("not been independently verified")
  })
})
