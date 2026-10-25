import { describe, expect, it } from "vitest"
import { publicQuizQuestions } from "./assessment"

describe("publicQuizQuestions", () => {
  it("strips answer keys while preserving learner-facing question data", () => {
    const result = publicQuizQuestions([{
      q: "What is 2 + 2?",
      options: ["3", "4", "5", "6"],
      correct: 1,
      explanation: "Adding two and two gives four.",
    }])

    expect(result).toEqual([{
      q: "What is 2 + 2?",
      options: ["3", "4", "5", "6"],
      explanation: "Adding two and two gives four.",
    }])
    expect("correct" in result[0]).toBe(false)
  })
})
