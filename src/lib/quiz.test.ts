import { describe, it, expect } from "vitest"
import {
  isPlaceholderQuestion,
  needsRealQuiz,
  isValidQuiz,
  buildQuizPrompt,
} from "./quiz"
import type { QuizQuestion } from "./mockData"

const placeholder: QuizQuestion = {
  q: "What is X?",
  options: ["Option A", "Option B", "Option C", "Option D"],
  correct: 0,
  explanation: "Review the lesson.",
}

const real: QuizQuestion = {
  q: "Which hook runs after render?",
  options: ["useState", "useEffect", "useMemo", "useRef"],
  correct: 1,
  explanation: "useEffect runs after the render commits.",
}

describe("isPlaceholderQuestion", () => {
  it("detects seed placeholders", () => {
    expect(isPlaceholderQuestion(placeholder)).toBe(true)
  })
  it("rejects real and malformed questions", () => {
    expect(isPlaceholderQuestion(real)).toBe(false)
    expect(isPlaceholderQuestion({ ...real, options: ["a", "b", "c"] })).toBe(false)
  })
})

describe("needsRealQuiz", () => {
  it("requires generation for missing/empty/placeholder quizzes", () => {
    expect(needsRealQuiz(undefined)).toBe(true)
    expect(needsRealQuiz(null)).toBe(true)
    expect(needsRealQuiz([])).toBe(true)
    expect(needsRealQuiz([real, placeholder])).toBe(true)
  })
  it("accepts fully real quizzes", () => {
    expect(needsRealQuiz([real, { ...real, q: "Q2" }])).toBe(false)
  })
})

describe("isValidQuiz", () => {
  const valid = [real, { ...real, q: "Q2" }, { ...real, q: "Q3" }]
  it("accepts 3–6 well-formed questions", () => {
    expect(isValidQuiz(valid)).toBe(true)
    expect(isValidQuiz([...valid, { ...real, q: "Q4" }, { ...real, q: "Q5" }, { ...real, q: "Q6" }])).toBe(true)
  })
  it("rejects wrong counts and shapes", () => {
    expect(isValidQuiz([])).toBe(false)
    expect(isValidQuiz([real, { ...real, q: "Q2" }])).toBe(false)
    expect(isValidQuiz("nope")).toBe(false)
    expect(isValidQuiz([{}])).toBe(false)
  })
  it("rejects bad answers and explanations", () => {
    expect(isValidQuiz([{ ...real, correct: 4 }])).toBe(false)
    expect(isValidQuiz([{ ...real, correct: -1 }])).toBe(false)
    expect(isValidQuiz([{ ...real, explanation: "  " }])).toBe(false)
    expect(isValidQuiz([{ ...real, options: ["a", "b", "c", ""] }])).toBe(false)
    expect(isValidQuiz([{ ...real, options: ["a", "b", "c"] }])).toBe(false)
    expect(isValidQuiz([{ ...real, q: "" }])).toBe(false)
  })
})

describe("buildQuizPrompt", () => {
  it("requests 4 standard questions by default", () => {
    const p = buildQuizPrompt("Closures", "LOREM content here")
    expect(p).toContain("4 multiple-choice")
    expect(p).toContain("Closures")
    expect(p).toContain("LOREM content here")
    expect(p).toContain("Core understanding")
    expect(p).toContain("Return ONLY valid JSON")
  })
  it("adapts count and difficulty per mode", () => {
    expect(buildQuizPrompt("T", "C", "remedial")).toContain("3 multiple-choice")
    expect(buildQuizPrompt("T", "C", "remedial")).toContain("Foundational")
    expect(buildQuizPrompt("T", "C", "challenge")).toContain("5 multiple-choice")
    expect(buildQuizPrompt("T", "C", "challenge")).toContain("edge cases")
  })
})
