import type { QuizQuestion } from "./mockData"

// Quiz helpers shared by the lesson-quiz API route and the lesson page.
// Placeholder quizzes (seeded at roadmap-generation time) are replaced
// lazily with AI-generated questions on first lesson open.

const PLACEHOLDER_OPTIONS = ["Option A", "Option B", "Option C", "Option D"]

export const QUIZ_QUESTION_COUNT = 4
export const QUIZ_BANK_SIZE = 6
export const QUIZ_ATTEMPT_SIZE = 4

export type QuizMode = "remedial" | "standard" | "challenge"

const QUIZ_COUNTS: Record<QuizMode, number> = { remedial: 3, standard: QUIZ_BANK_SIZE, challenge: 5 }

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
  if (!Array.isArray(quiz) || quiz.length < 1 || quiz.length > 12) return null
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
    const difficulty = typeof r.difficulty === "string" && ["easy","medium","hard"].includes(r.difficulty) ? r.difficulty as QuizQuestion["difficulty"] : undefined
    out.push({ q: (r.q as string).trim(), options, correct, explanation: (r.explanation as string).trim(), ...(difficulty ? { difficulty } : {}) })
  }
  return out
}

export function isQuizBankComplete(bank: QuizQuestion[] | null | undefined): boolean {
  return !!bank && bank.length >= QUIZ_BANK_SIZE && !needsRealQuiz(bank)
}

export function buildQuizPrompt(title: string, content: string, mode: QuizMode = "standard"): string {
  const excerpt = content.slice(0, 4000)
  const count = QUIZ_COUNTS[mode]
  const difficulty =
    mode === "remedial"
      ? "Foundational recall and definitions only. Incorrect options must be clearly distinguishable from the correct answer. Explanations must reteach the concept in one encouraging sentence."
      : mode === "challenge"
        ? "Application, edge cases, and common misconceptions. Distractors must be plausible near-miss answers. Explanations must state WHY each wrong option fails, in one sentence."
        : "Core understanding of the lesson. Plausible distractors with exactly one correct answer. Tag each question difficulty: 2 easy, 5 medium, 3 hard. Include difficulty field per question (easy|medium|hard)."
  return `Generate ${count} multiple-choice quiz questions testing understanding of the lesson "${title}". Rules: each question has exactly 4 distinct answer options with exactly one correct answer; the correct answer must NOT always be the first option — vary its position; each question needs a one-sentence explanation of the correct answer. ${count >= 8 ? "Cover the lesson's key concepts broadly — avoid near-duplicate questions." : ""} Difficulty: ${difficulty} Return ONLY valid JSON: {questions:[{q, options:[4 strings], correct (0-3 index into options), explanation, difficulty}]} No explanatory text, no markdown fences.

Lesson content:
${excerpt}`

}

/** Sample up to `count` questions from a bank, shuffled. Deterministic per attempt when `seed` given. */
export function sampleQuiz(bank: QuizQuestion[], count: number, seed: string = ""): QuizQuestion[] {
  if (bank.length <= count) return [...bank]
  const rng = seed ? mulberry32(hashStr(seed)) : Math.random
  const idxs = bank.map((_, i) => i)
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor((rng as () => number)() * (i + 1))
    ;[idxs[i], idxs[j]] = [idxs[j] as number, idxs[i] as number]
  }
  return idxs.slice(0, count).map((i) => bank[i] as QuizQuestion)
}

export type SampleBias = "easy" | "balanced" | "hard"

/** Difficulty-aware sampling for adaptive learning. */
export function sampleQuizByDifficulty(bank: QuizQuestion[], count: number, bias: SampleBias = "balanced", seed: string = ""): QuizQuestion[] {
  if (bank.length <= count) return [...bank]
  const tagged = bank.map((q, i) => ({ q, i, d: q.difficulty ?? "medium" as const }))
  const byDiff = {
    easy: tagged.filter((x) => x.d === "easy"),
    medium: tagged.filter((x) => x.d === "medium"),
    hard: tagged.filter((x) => x.d === "hard"),
  }
  // If untagged, fallback to shuffled sample
  if (byDiff.easy.length + byDiff.medium.length + byDiff.hard.length === 0) return sampleQuiz(bank, count, seed)
  const plan: Record<SampleBias, { easy: number; medium: number; hard: number }> = {
    easy: { easy: 2, medium: 1, hard: 1 },
    balanced: { easy: 1, medium: 2, hard: 1 },
    hard: { easy: 0, medium: 1, hard: 3 },
  }
  // Challenge mode: 3 hard +2 medium
  const want = bias === "hard" && count === 5 ? { easy: 0, medium: 2, hard: 3 } : plan[bias]
  // Adjust if not enough of a tier, spill to medium
  const pick = (arr: typeof tagged, n: number, rng: () => number) => {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j] as typeof copy[number], copy[i] as typeof copy[number]]
    }
    return copy.slice(0, Math.min(n, copy.length))
  }
  const rng = seed ? mulberry32(hashStr(seed)) : Math.random as unknown as () => number
  const chosen: typeof tagged = []
  let remaining = count
  const take = (tier: "easy"|"medium"|"hard", n: number) => {
    const available = byDiff[tier]
    const need = Math.min(n, remaining, available.length)
    const picked = pick(available.filter((x) => !chosen.some((c) => c.i === x.i)), need, rng as () => number)
    chosen.push(...picked)
    remaining -= picked.length
  }
  take("easy", want.easy)
  take("hard", want.hard)
  take("medium", want.medium)
  // Fill remainder from any left
  if (remaining > 0) {
    const leftover = tagged.filter((x) => !chosen.some((c) => c.i === x.i))
    chosen.push(...pick(leftover, remaining, rng as () => number))
  }
  // Shuffle final set to avoid difficulty clustering
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor((rng as () => number)() * (i + 1))
    ;[chosen[i], chosen[j]] = [chosen[j] as typeof chosen[number], chosen[i] as typeof chosen[number]]
  }
  return chosen.map((x) => x.q)
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function mulberry32(a: number) {
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
