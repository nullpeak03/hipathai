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
  it("accepts 1–12 well-formed questions (bank up to 10)", () => {
    expect(isValidQuiz([real])).toBe(true)
    expect(isValidQuiz(valid)).toBe(true)
    expect(isValidQuiz([...valid, { ...real, q: "Q4" }, { ...real, q: "Q5" }, { ...real, q: "Q6" }])).toBe(true)
    const bank10 = Array.from({ length: 10 }, (_, i) => ({ ...real, q: `Q${i}` }))
    expect(isValidQuiz(bank10)).toBe(true)
  })
  it("rejects wrong counts and shapes", () => {
    expect(isValidQuiz([])).toBe(false)
    const bank13 = Array.from({ length: 13 }, (_, i) => ({ ...real, q: `Q${i}` }))
    expect(isValidQuiz(bank13)).toBe(false)
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

describe("normalizeQuizQuestions", () => {
  it("passes valid quizzes through with trimming", async () => {
    const { normalizeQuizQuestions } = await import("./quiz")
    const out = normalizeQuizQuestions([{ ...real, q: "  Q?  ", explanation: " E. " }])
    expect(out).toEqual([{ ...real, q: "Q?", explanation: "E." }])
  })
  it("resolves string answers to option indexes", async () => {
    const { normalizeQuizQuestions } = await import("./quiz")
    const out = normalizeQuizQuestions([{
      q: "Q?",
      options: ["Chemical energy", "Solar energy", "Electrical", "Thermal"],
      correct: "Solar energy",
      explanation: "E.",
    }])
    expect(out?.[0]?.correct).toBe(1)
  })
  it("matches case-insensitively but requires uniqueness", async () => {
    const { normalizeQuizQuestions } = await import("./quiz")
    const ci = normalizeQuizQuestions([{
      q: "Q?", options: ["a", "B", "c", "d"], correct: "b", explanation: "E.",
    }])
    expect(ci?.[0]?.correct).toBe(1)
    const dup = normalizeQuizQuestions([{
      q: "Q?", options: ["Same", "same", "c", "d"], correct: "SAME", explanation: "E.",
    }])
    expect(dup).toBeNull()
    expect(normalizeQuizQuestions([{
      q: "Q?", options: ["a", "b", "c", "d"], correct: "zzz", explanation: "E.",
    }])).toBeNull()
  })
  it("rejects non-integer and out-of-range indexes", async () => {
    const { normalizeQuizQuestions } = await import("./quiz")
    expect(normalizeQuizQuestions([{ ...real, correct: 1.5 }])).toBeNull()
    expect(normalizeQuizQuestions([{ ...real, correct: "1" }])).toBeNull()
  })
})

describe("buildQuizPrompt", () => {
  it("lets the model size the bank within the standard range", () => {
    const p = buildQuizPrompt("Closures", "LOREM content here")
    expect(p).toContain("bank of 3–10 questions")
    expect(p).toContain("Judge the lesson's density yourself")
    expect(p).toContain("Closures")
    expect(p).toContain("LOREM content here")
    expect(p).toContain("Core understanding")
    expect(p).toContain("Return ONLY valid JSON")
  })
  it("adapts ranges and difficulty per mode", () => {
    expect(buildQuizPrompt("T", "C", "remedial")).toContain("2–4 questions")
    expect(buildQuizPrompt("T", "C", "remedial")).toContain("foundational recall")
    expect(buildQuizPrompt("T", "C", "challenge")).toContain("4–6 questions")
    expect(buildQuizPrompt("T", "C", "challenge")).toContain("edge cases")
    expect(buildQuizPrompt("T", "C", "standard")).toContain("a third easy, half medium")
  })
  it("asks models to fence code spans for panel rendering", () => {
    expect(buildQuizPrompt("T", "C", "standard")).toContain("triple-backtick")
  })
  it("forbids a 5th option (observed live defect: options length 5)", () => {
    const p = buildQuizPrompt("T", "C", "standard")
    expect(p).toContain("stop at 4")
    expect(p).toContain("NEVER add a 5th option")
  })
})

describe("normalizeQuizQuestions defects", () => {
  it("reports the first defect reason instead of silent null", async () => {
    const { normalizeQuizQuestions } = await import("./quiz")
    const seen: [number, string][] = []
    expect(normalizeQuizQuestions([{ q: "Q?", options: ["a", "b", "c"], correct: 0, explanation: "E." }], (i, r) => { seen.push([i, r]) })).toBeNull()
    expect(seen).toEqual([[0, expect.stringContaining("options length 3")]])
    expect(normalizeQuizQuestions("nope", (i, r) => { seen.push([i, r]) })).toBeNull()
    expect(seen.at(-1)).toEqual([-1, expect.stringContaining("not an array")])
    expect(normalizeQuizQuestions([{ q: "Q?", options: ["a", "b", "c", "d"], correct: 0, explanation: "  " }], (i, r) => { seen.push([i, r]) })).toBeNull()
    expect(seen.at(-1)).toEqual([0, expect.stringContaining("explanation")])
  })
})

describe("salvageOptionsList", () => {
  it("splits string options on newlines or A-D markers", async () => {
    const { salvageOptionsList } = await import("./quiz")
    expect(salvageOptionsList(["a", "b", "c", "d"])).toEqual(["a", "b", "c", "d"])
    expect(salvageOptionsList("A) alpha\nB) beta\nC) gamma\nD) delta")).toEqual(["alpha", "beta", "gamma", "delta"])
    expect(salvageOptionsList("A) alpha B) beta C) gamma D) delta")).toEqual(["alpha", "beta", "gamma", "delta"])
    expect(salvageOptionsList(["A) alpha", "beta", "gamma", "delta"])).toEqual(["alpha", "beta", "gamma", "delta"])
    expect(salvageOptionsList(["a", "b", "c"])).toBeNull()
    expect(salvageOptionsList(["a", "b", "c", "d", "e"])).toBeNull()
    expect(salvageOptionsList("just one blob")).toBeNull()
    expect(salvageOptionsList(42)).toBeNull()
  })
  it("salvages string-options banks through normalize", async () => {
    const { normalizeQuizQuestions } = await import("./quiz")
    const out = normalizeQuizQuestions([{
      q: "Q?", options: "A) alpha B) beta C) gamma D) delta", correct: 1, explanation: "E.",
    }])
    expect(out?.[0]?.options).toEqual(["alpha", "beta", "gamma", "delta"])
    expect(out?.[0]?.correct).toBe(1)
  })
})

describe("isQuizBankComplete", () => {
  it("accepts variable model-sized banks from the floor up", async () => {
    const { isQuizBankComplete } = await import("./quiz")
    const mk = (n: number) => Array.from({ length: n }, (_, i) => ({
      q: `Q${i}?`, options: ["a", "b", "c", "d"], correct: 0, explanation: "E.",
    }))
    expect(isQuizBankComplete(mk(3))).toBe(true)
    expect(isQuizBankComplete(mk(10))).toBe(true)
    expect(isQuizBankComplete(mk(2))).toBe(false)
    expect(isQuizBankComplete([])).toBe(false)
    expect(isQuizBankComplete(null)).toBe(false)
  })
})

describe("splitQuizCodeSpans", () => {
  it("splits fenced spans into code panels", async () => {
    const { splitQuizCodeSpans } = await import("./quiz")
    const spans = splitQuizCodeSpans("What prints?\n```python\nprint(x)\n```\nChoose.")
    expect(spans).toEqual([
      { kind: "text", text: "What prints?\n" },
      { kind: "code", language: "python", code: "print(x)" },
      { kind: "text", text: "\nChoose." },
    ])
  })
  it("passes plain text through as a single span", async () => {
    const { splitQuizCodeSpans } = await import("./quiz")
    expect(splitQuizCodeSpans("What is x?")).toEqual([{ kind: "text", text: "What is x?" }])
    expect(splitQuizCodeSpans("Use `x = 5` here.")).toEqual([{ kind: "text", text: "Use `x = 5` here." }])
  })
})
