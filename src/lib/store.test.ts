import { describe, it, expect, vi, afterEach } from "vitest"
import {
  loadRoadmapAsync,
  loadGamAsync,
  loadWeakTopics,
  loadDailyActivity,
  requestQuiz,
  supabaseSaveGam,
  type Gamification,
} from "./store"

const fullRoadmap = {
  id: "r1",
  title: "T",
  description: "D",
  totalLessons: 1,
  phases: [],
}

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload } as unknown as Response
}

function failFetch() {
  return { ok: false, json: async () => ({}) } as unknown as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("loadRoadmapAsync", () => {
  it("returns the server roadmap when available", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okJson({ roadmap: fullRoadmap })))
    await expect(loadRoadmapAsync()).resolves.toEqual(fullRoadmap)
  })
  it("falls back to cache (null in non-browser env) when offline", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => failFetch()))
    await expect(loadRoadmapAsync()).resolves.toBeNull()
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down") }))
    await expect(loadRoadmapAsync()).resolves.toBeNull()
  })
})

describe("loadGamAsync", () => {
  it("returns server gamification when present", async () => {
    const gam: Gamification = {
      xp: 40, level: 1, streak: 2, bestStreak: 2,
      passRate: 100, studyMinutes: 30, lessonsDone: 2, lastStudyDate: "2026-09-19",
    }
    vi.stubGlobal("fetch", vi.fn(async () => okJson({ gamification: gam, progress: {} })))
    await expect(loadGamAsync()).resolves.toEqual(gam)
  })
  it("falls back to fresh gamification when signed out", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => failFetch()))
    const gam = await loadGamAsync()
    expect(gam).toMatchObject({ xp: 0, level: 1, streak: 0 })
  })
})

describe("loadWeakTopics / loadDailyActivity", () => {
  it("returns rows and defaults to empty lists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => okJson({ topics: [{ topic: "X", fail_count: 2 }] }))
    )
    await expect(loadWeakTopics()).resolves.toEqual([{ topic: "X", fail_count: 2 }])

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => okJson({ days: [{ date: "2026-09-19", minutes: 20, xp: 20, lessons: 1 }] }))
    )
    await expect(loadDailyActivity(7)).resolves.toHaveLength(1)

    vi.stubGlobal("fetch", vi.fn(async () => failFetch()))
    await expect(loadWeakTopics()).resolves.toEqual([])
    await expect(loadDailyActivity()).resolves.toEqual([])
  })
})

describe("requestQuiz", () => {
  const realQuiz = [{
    q: "Q?", options: ["a", "b", "c", "d"], correct: 1, explanation: "E.",
  }, {
    q: "Q2?", options: ["a", "b", "c", "d"], correct: 0, explanation: "E.",
  }, {
    q: "Q3?", options: ["a", "b", "c", "d"], correct: 3, explanation: "E.",
  }]
  it("returns validated quizzes and posts the mode", async () => {
    const calls: { url: unknown; init: { body?: string } }[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init: { body?: string }) => {
        calls.push({ url, init })
        return okJson({ quiz: realQuiz })
      }) as unknown as typeof fetch
    )
    const quiz = await requestQuiz("lesson-1", "remedial")
    expect(quiz).toEqual(realQuiz)
    expect(calls[0].url).toBe("/api/lessons/quiz")
    expect(JSON.parse(calls[0].init.body ?? "{}")).toMatchObject({ lessonId: "lesson-1", mode: "remedial" })
  })
  it("rejects invalid quizzes and failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okJson({ quiz: [{ nope: true }] })))
    await expect(requestQuiz("lesson-1")).resolves.toBeNull()
    vi.stubGlobal("fetch", vi.fn(async () => failFetch()))
    await expect(requestQuiz("lesson-1")).resolves.toBeNull()
  })
})

describe("supabaseSaveGam", () => {
  it("POSTs the gamification payload", async () => {
    const calls: { url: unknown; init: { body?: string } }[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init: { body?: string }) => {
        calls.push({ url, init })
        return okJson({ ok: true })
      }) as unknown as typeof fetch
    )
    const gam: Gamification = {
      xp: 20, level: 1, streak: 1, bestStreak: 1,
      passRate: 100, studyMinutes: 15, lessonsDone: 1, lastStudyDate: "today",
    }
    await supabaseSaveGam(gam)
    expect(calls[0].url).toBe("/api/me/gamification")
    expect(JSON.parse(calls[0].init.body ?? "{}")).toMatchObject({ gam })
  })
})
