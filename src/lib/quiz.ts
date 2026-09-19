import type { QuizQuestion } from "./mockData"

// Quiz helpers shared by the lesson-quiz API route and the lesson page.
// Placeholder quizzes (seeded at roadmap-generation time) are replaced
// lazily with AI-generated questions on first lesson open.

const PLACEHOLDER_OPTIONS = ["Option A", "Option B", "Option C", "Option D"]

export const QUIZ_QUESTION_COUNT = 4

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

export function buildQuizPrompt(title: string, content: string): string {
  const excerpt = content.slice(0, 3000)
  return `Generate ${QUIZ_QUESTION_COUNT} multiple-choice quiz questions testing understanding of the lesson "${title}". Rules: each question has exactly 4 distinct, plausible answer options with exactly one correct answer; the correct answer must NOT always be the first option — vary its position; each question needs a one-sentence explanation of the correct answer. Return ONLY valid JSON: {questions:[{q, options:[4 strings], correct (0-3 index into options), explanation}]} No explanatory text, no markdown fences.

Lesson content:
${excerpt}`
}
