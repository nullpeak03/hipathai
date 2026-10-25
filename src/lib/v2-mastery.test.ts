import { describe, it, expect } from "vitest"
import {
  LESSON_PASS_THRESHOLD,
  PHASE_EXAM_PASS_THRESHOLD,
  V2_MASTERY_THRESHOLD,
  isMastered,
  decayedMastery,
  masteryFromQuiz,
} from "./v2-mastery"

describe("v2 mastery", () => {
  it("separates progression pass thresholds from mastery", () => {
    expect(LESSON_PASS_THRESHOLD).toBe(60)
    expect(PHASE_EXAM_PASS_THRESHOLD).toBe(LESSON_PASS_THRESHOLD)
    expect(V2_MASTERY_THRESHOLD).toBe(90)
    expect(isMastered(LESSON_PASS_THRESHOLD)).toBe(false)
  })

  it("uses 90% threshold", () => {
    expect(V2_MASTERY_THRESHOLD).toBe(90)
  })

  it("marks mastered at threshold", () => {
    expect(isMastered(90)).toBe(true)
    expect(isMastered(89)).toBe(false)
  })

  it("allows analytics boost", () => {
    expect(isMastered(85, 5)).toBe(true)
  })

  it("decays mastery over time", () => {
    expect(decayedMastery(100, 0, 0.05)).toBe(100)
    expect(decayedMastery(100, 10, 0.05)).toBeLessThan(100)
  })

  it("penalizes repeated attempts", () => {
    expect(masteryFromQuiz(95, 1)).toBe(95)
    expect(masteryFromQuiz(95, 2)).toBe(92)
  })
})
