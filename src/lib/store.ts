"use client"
import type { Phase, QuizQuestion } from "./mockData"
import { normalizeQuizQuestions, type QuizMode } from "./quiz"

export type RoadmapData = { id: string; title: string; description: string; phases: Phase[]; totalLessons: number }
const KEY = "hipath_roadmap"
const GAM_KEY = "hipath_gamification"
const PROG_KEY = "hipath_progress" // lesson completion

export function saveRoadmap(data: RoadmapData) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(data))
}
export function loadRoadmap(): RoadmapData | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}
export function clearRoadmap() { if (typeof window !== "undefined") localStorage.removeItem(KEY) }

export const FRESH_GAM: Gamification = { xp: 0, level: 1, streak: 0, bestStreak: 0, passRate: 0, studyMinutes: 0, lessonsDone: 0, lastStudyDate: "" }
export type Gamification = { xp: number; level: number; streak: number; bestStreak: number; passRate: number; studyMinutes: number; lessonsDone: number; lastStudyDate?: string }
export function saveGam(g: Gamification) { if (typeof window !== "undefined") localStorage.setItem(GAM_KEY, JSON.stringify(g)) }
export function loadGam(): Gamification {
  if (typeof window === "undefined") return { ...FRESH_GAM }
  const raw = localStorage.getItem(GAM_KEY)
  if (!raw) return { ...FRESH_GAM }
  try { return JSON.parse(raw) } catch { return { ...FRESH_GAM } }
}

// progress: map lessonId -> {completed, passed}
export type Progress = Record<string, { completed: boolean; passed: boolean; score?: number }>
export function loadProgress(): Progress {
  if (typeof window === "undefined") return {}
  const raw = localStorage.getItem(PROG_KEY)
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}
export function saveProgress(p: Progress) { if (typeof window !== "undefined") localStorage.setItem(PROG_KEY, JSON.stringify(p)) }

// Remote sync — all traffic goes through service-role API routes (the
// browser anon key is RLS-denied by design, and identity always comes from
// the server session). Every helper degrades to localStorage when offline
// or signed out, so the app keeps working without a backend.
export type WeakTopic = { topic: string; fail_count: number }

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function postJson(url: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function loadRoadmapAsync(): Promise<RoadmapData | null> {
  // Supabase is the source of truth; localStorage is only a cache.
  const data = await getJson<{ roadmap: RoadmapData | null }>("/api/me/roadmap")
  if (data?.roadmap) {
    saveRoadmap(data.roadmap) // refresh cache for offline/fast paint
    return data.roadmap
  }
  return loadRoadmap()
}

export async function loadGamAsync(): Promise<Gamification> {
  const local = loadGam()
  const data = await getJson<{ gamification: Gamification | null; progress: Progress }>("/api/me/activity")
  if (data?.gamification) {
    saveGam(data.gamification)
    return data.gamification
  }
  return local
}

export async function loadProgressAsync(): Promise<Progress> {
  const local = loadProgress()
  const data = await getJson<{ gamification: Gamification | null; progress: Progress }>("/api/me/activity")
  if (data && data.progress && Object.keys(data.progress).length > 0) {
    saveProgress(data.progress)
    return data.progress
  }
  return local
}

export async function loadWeakTopics(): Promise<WeakTopic[]> {
  const data = await getJson<{ topics: WeakTopic[] }>("/api/me/weak-topics")
  return data?.topics ?? []
}

export async function supabaseSaveGam(g: Gamification): Promise<void> {
  await postJson("/api/me/gamification", { gam: g })
}
export async function supabaseSaveProgress(lessonId: string, passed: boolean, score: number): Promise<void> {
  await postJson("/api/me/progress", { lessonId, passed, score })
}
export async function supabaseSaveQuizAttempt(
  lessonId: string,
  answers: Record<number, number>,
  score: number,
  passed: boolean,
  topic?: string
): Promise<void> {
  await postJson("/api/me/quiz-attempt", { lessonId, answers, score, passed, topic })
}

export type ActivityDay = { date: string; minutes: number; xp: number; lessons: number }

/** Per-day study history for heatmaps and week-over-week stats. */
export async function loadDailyActivity(days = 14): Promise<ActivityDay[]> {
  const data = await getJson<{ days: ActivityDay[] }>(`/api/me/daily-activity?days=${days}`)
  return data?.days ?? []
}

/** Log real lesson dwell time (server clamps + stamps the day). */
export async function logStudySession(minutes: number, xp: number, lessons: number): Promise<void> {
  await postJson("/api/me/study", { minutes, xp, lessons })
}

export type Benchmarks = {
  learners: number
  avgXp: number
  avgLevel: number
  avgStreak: number
  avgPassRate: number
  avgWeeklyMinutes: number
}

/** Aggregate-only community stats (no PII) for benchmark comparisons. */
export async function loadBenchmarks(): Promise<Benchmarks | null> {
  const data = await getJson<Benchmarks>("/api/me/benchmarks")
  return data ?? null
}

export type ReviewItem = {
  lessonId: string
  roadmapId: string
  title: string
  topic: string
  repetitions: number
  lastScore: number | null
  nextReviewAt: string
  overdueDays: number
}

/** Fetch an AI-generated quiz set (standard = canonical bank sized by the model, variants are practice-only). */
export async function requestQuiz(lessonId: string, mode: QuizMode = "standard", onProgress?: (msg: string) => void): Promise<QuizQuestion[] | null> {
  try {
    const res = await fetch("/api/lessons/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, mode }),
    })
    if (res.status === 202) {
      const data = (await res.json()) as { jobId?: string }
      if (!data.jobId) return null
      onProgress?.("Generating your quiz…")
      await waitForJob(data.jobId, {
        timeoutMs: 180000,
        onProgress: (ms) => onProgress?.(`Generating quiz… ${Math.round(ms / 1000)}s`),
      })
      // Fetch the completed bank (now cached)
      const retry = await fetch("/api/lessons/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, mode }),
      })
      if (!retry.ok) return null
      const retryData = (await retry.json()) as { quiz?: QuizQuestion[] }
      return normalizeQuizQuestions(retryData.quiz)
    }
    if (!res.ok) return null
    const data = (await res.json()) as { quiz?: QuizQuestion[] }
    return normalizeQuizQuestions(data.quiz)
  } catch {
    return null
  }
}

/**
 * Delete a lesson's quiz bank after a pass so retakes generate fresh
 * questions. Progress/scores are untouched — only question content goes.
 */
export async function deleteQuizBank(lessonId: string): Promise<boolean> {
  try {
    const res = await fetch("/api/lessons/quiz", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function requestPhaseExam(phaseId: string): Promise<QuizQuestion[] | null> {
  try {
    const res = await fetch("/api/phases/exam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phaseId }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { quiz?: QuizQuestion[] }
    return normalizeQuizQuestions(data.quiz)
  } catch {
    return null
  }
}

export type GeneratedLesson = { contentMd: string; exampleCode: string }

export type LessonContentResult =
  | { cached: true; contentMd: string; exampleCode: string }
  | { cached?: false; jobId: string }

/**
 * Lesson content is generated async (1-3 min, beyond route limits):
 * returns cached content immediately, otherwise a jobId to poll with
 * waitForJob. Pass regenerate:true to rebuild existing content.
 */
export async function requestLessonContent(lessonId: string, regenerate = false): Promise<LessonContentResult | null> {
  try {
    const res = await fetch("/api/lessons/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, regenerate }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      contentMd?: string
      exampleCode?: string
      cached?: boolean
      jobId?: string
    }
    if (data.jobId) return { jobId: data.jobId }
    if (!data.contentMd || data.contentMd.trim().length === 0) return null
    return { cached: true, contentMd: data.contentMd, exampleCode: data.exampleCode ?? "" }
  } catch {
    return null
  }
}

/** Poll a generation job until completed/failed/timeout (shared by onboarding-style flows). */
export async function waitForJob(
  jobId: string,
  opts: { intervalMs?: number; timeoutMs?: number; onProgress?: (elapsedMs: number) => void } = {}
): Promise<{ status: string; error?: string }> {
  const started = Date.now()
  const interval = opts.intervalMs ?? 3000
  const timeout = opts.timeoutMs ?? 600000
  for (;;) {
    const data = await getJson<{ status?: string; error?: string }>(`/api/roadmaps/status/${jobId}`)
    if (data?.status === "completed") return { status: "completed", error: data.error }
    if (data?.status === "failed") throw new Error(data.error || "Generation failed")
    if (Date.now() - started > timeout) throw new Error("Generation timed out. Please try again.")
    opts.onProgress?.(Date.now() - started)
    await new Promise((r) => setTimeout(r, interval))
  }
}

/** Lessons due for spaced-repetition review, most overdue first. */
export async function loadDueReviews(): Promise<ReviewItem[]> {
  const data = await getJson<{ reviews: ReviewItem[] }>("/api/me/reviews")
  return data?.reviews ?? []
}

export type PhaseProgress = Record<string, { passed: boolean; score: number | null; attempts: number }>
export async function loadPhaseProgress(): Promise<PhaseProgress> {
  const data = await getJson<{ progress: PhaseProgress }>("/api/me/phase-progress")
  return data?.progress ?? {}
}
export async function submitPhaseProgress(phaseId: string, passed: boolean, score: number): Promise<void> {
  await postJson("/api/me/phase-progress", { phaseId, passed, score })
}
