import type { QuizQuestion } from "./mockData"

// Quiz helpers shared by the lesson-quiz API route and the lesson page.
// Placeholder quizzes (seeded at roadmap-generation time) are replaced
// lazily with AI-generated questions on first lesson open.

const PLACEHOLDER_OPTIONS = ["Option A", "Option B", "Option C", "Option D"]

export const QUIZ_QUESTION_COUNT = 4

export type QuizMode = "remedial" | "standard" | "challenge"

const QUIZ_COUNTS: Record<QuizMode, number> = { remedial: 3, standard: 4, challenge: 5 }

export function isPlaceholderQuestion(q: QuizQuestion): boolean {
  if (!q || !Array.isArray(q.options) || q.options.length !== PLACEHOLDER_OPTIONS.length) return false
  return q.options.every((opt, i) => opt === PLACEHOLDER_OPTIONS[i])
}

/** True when the quiz is missing or still contains seed placeholders. */
export function needsRealQuiz(quiz: QuizQuestion[] | null | undefined): boolean {
  if (!quiz || quiz.length === 0) return true
  return quiz.some(isPlaceholderQuestion)
}

/** Validate AI-generated questions before persisting them. */
export function isValidQuiz(quiz: unknown): quiz is QuizQuestion[] {
  return normalizeQuizQuestions(quiz) !== null
}

/**
 * Validate + normalize: Nemotron variants emit `"correct": "<answer text>"`
 * instead of an index — resolve it against options (case-insensitive, must
 * be unique), else reject. Returns normalized questions or null.
 */
export function normalizeQuizQuestions(quiz: unknown): QuizQuestion[] | null {
  if (!Array.isArray(quiz) || quiz.length < 1 || quiz.length > 6) return null
  const out: QuizQuestion[] = []
  for (const item of quiz) {
    if (!item || typeof item !== "object") return null
    const r = item as Record<string, unknown>
    if (typeof r.q !== "string" || r.q.trim().length === 0) return null
    if (!Array.isArray(r.options) || r.options.length !== 4) return null
    if (!r.options.every((o: unknown) => typeof o === "string" && (o as string).trim().length > 0)) return null
    const options = (r.options as string[]).map((o) => o.trim())
    let correct: number | null = null
    if (typeof r.correct === "number" && Number.isInteger(r.correct) && r.correct >= 0 && r.correct <= 3) {
      correct = r.correct
    } else if (typeof r.correct === "string" && r.correct.trim().length > 0) {
      const want = r.correct.trim().toLowerCase()
      const matches = options
        .map((o, i) => (o.toLowerCase() === want ? i : -1))
        .filter((i) => i >= 0)
      if (matches.length !== 1 || matches[0] === undefined) return null
      correct = matches[0]
    } else {
      return null
    }
    if (typeof r.explanation !== "string" || r.explanation.trim().length === 0) return null
    out.push({ q: (r.q as string).trim(), options, correct, explanation: (r.explanation as string).trim() })
  }
  return out
}

export function buildQuizPrompt(title: string, content: string, mode: QuizMode = "standard"): string {
  const excerpt = content.slice(0, 3000)
  const count = QUIZ_COUNTS[mode]
  const difficulty =
    mode === "remedial"
      ? "Foundational recall and definitions only. Incorrect options must be clearly distinguishable from the correct answer. Explanations must reteach the concept in one encouraging sentence."
      : mode === "challenge"
        ? "Application, edge cases, and common misconceptions. Distractors must be plausible near-miss answers. Explanations must state WHY each wrong option fails, in one sentence."
        : "Core understanding of the lesson. Plausible distractors with exactly one correct answer."
  return `Generate ${count} multiple-choice quiz questions testing understanding of the lesson "${title}". Rules: each question has exactly 4 distinct answer options with exactly one correct answer; the correct answer must NOT always be the first option — vary its position; each question needs a one-sentence explanation of the correct answer. Difficulty: ${difficulty} Return ONLY valid JSON: {questions:[{q, options:[4 strings], correct (0-3 index into options), explanation}]} No explanatory text, no markdown fences.

Lesson content:
${excerpt}`
}
