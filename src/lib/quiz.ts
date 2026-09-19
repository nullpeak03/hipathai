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
  if (!Array.isArray(quiz) || quiz.length < 3 || quiz.length > 6) return false
  return quiz.every((q) => {
    if (!q || typeof q.q !== "string" || q.q.trim().length === 0) return false
    if (!Array.isArray(q.options) || q.options.length !== 4) return false
    if (!q.options.every((o: unknown) => typeof o === "string" && (o as string).trim().length > 0)) return false
    if (typeof q.correct !== "number" || q.correct < 0 || q.correct > 3) return false
    if (typeof q.explanation !== "string" || q.explanation.trim().length === 0) return false
    return true
  })
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
