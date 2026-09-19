"use client"
import type { Phase } from "./mockData"
import { createClient } from "./supabase/client"
import { toRoadmapData, type RoadmapRow, type PhaseRow, type LessonRow } from "./roadmap-shape"

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

// Supabase sync helpers — fully to Supabase per P3 (non-blocking, fallback to localStorage)
export function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!(url && anon)
}
export async function loadRoadmapAsync(userId?: string): Promise<RoadmapData | null> {
  // Supabase is the source of truth; localStorage is only a cache.
  if (userId && isSupabaseConfigured()) {
    try {
      const supabase = createClient()
      const { data: roadmap } = await supabase.from("roadmaps").select("id,title,description,lessons_total").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).single()
      if (roadmap) {
        const row = roadmap as unknown as RoadmapRow
        const { data: phases } = await supabase.from("phases").select("id,idx,title").eq("roadmap_id", row.id).order("idx")
        const { data: lessons } = await supabase.from("lessons").select("id,phase_id,idx,title,content_md,example_code,quiz").eq("roadmap_id", row.id).order("idx")
        const data = toRoadmapData(row, (phases ?? []) as PhaseRow[], (lessons ?? []) as LessonRow[])
        // Refresh cache for offline/fast paint
        saveRoadmap(data)
        return data
      }
    } catch {
      // fall through to cache
    }
  }
  return loadRoadmap()
}
export async function loadGamAsync(userId?: string): Promise<Gamification> {
  const local = loadGam()
  if (!userId || !isSupabaseConfigured()) return local
  try {
    const supabase = createClient()
    const { data } = await supabase.from("gamification").select("*").eq("user_id", userId).single()
    if (data) {
      const g = { xp: data.xp||0, level: data.level||1, streak: data.streak||0, bestStreak: data.best_streak||0, passRate: data.pass_rate||0, studyMinutes: data.study_minutes||0, lessonsDone: data.lessons_done||0 }
      saveGam(g)
      return g
    }
  } catch {}
  return local
}
export async function loadProgressAsync(userId?: string): Promise<Progress> {
  const local = loadProgress()
  if (!userId || !isSupabaseConfigured() || Object.keys(local).length>0) return local
  try {
    const supabase = createClient()
    const { data } = await supabase.from("progress").select("lesson_id,completed,passed,score").eq("user_id", userId)
    if (data && data.length) {
      const p: Progress = {}
      for (const r of data) p[r.lesson_id] = { completed: r.completed, passed: r.passed, score: r.score }
      saveProgress(p)
      return p
    }
  } catch {}
  return local
}
export async function supabaseSaveRoadmap(userId: string, data: RoadmapData) {
  // Persist a full RoadmapData under its own id (upsert — never duplicates).
  // Phases/lessons are bulk-upserted by id in two calls.
  try {
    const supabase = createClient()
    const { error: roadmapError } = await supabase.from("roadmaps").upsert({
      id: data.id, user_id: userId, title: data.title, description: data.description,
      goal: data.title, lessons_total: data.totalLessons
    }, { onConflict: "id" })
    if (roadmapError) throw roadmapError
    const phaseRows = data.phases.map((phase) => ({
      id: phase.id, roadmap_id: data.id, idx: phase.idx, title: phase.title
    }))
    const { error: phaseError } = await supabase.from("phases").upsert(phaseRows, { onConflict: "id" })
    if (phaseError) throw phaseError
    const lessonRows = data.phases.flatMap((phase) =>
      phase.lessons.map((ls) => ({
        id: ls.id, roadmap_id: data.id, phase_id: phase.id, idx: ls.idx, title: ls.title,
        content_md: ls.contentMd, example_code: ls.exampleCode, quiz: ls.quiz
      }))
    )
    if (lessonRows.length > 0) {
      const { error: lessonError } = await supabase.from("lessons").upsert(lessonRows, { onConflict: "id" })
      if (lessonError) throw lessonError
    }
    return data.id
  } catch (e) { console.warn("supabaseSaveRoadmap failed", e); return null }
}
export async function supabaseSaveGam(userId: string, g: Gamification) {
  try { const supabase = createClient(); await supabase.from("gamification").upsert({ user_id: userId, ...g }, { onConflict: "user_id" })} catch {}
}
export async function supabaseSaveProgress(userId: string, lessonId: string, passed: boolean, score: number) {
  try { const supabase = createClient(); await supabase.from("progress").upsert({ user_id: userId, lesson_id: lessonId, completed: true, passed, score }, { onConflict: "user_id,lesson_id" })} catch {}
}
export async function supabaseSaveQuizAttempt(userId: string, lessonId: string, answers: Record<number, number>, score: number, passed: boolean) {
  try {
    const supabase = createClient()
    await supabase.from("quiz_attempts").insert({ user_id: userId, lesson_id: lessonId, answers, score, passed })
  } catch (e) { console.warn("supabaseSaveQuizAttempt failed", e) }
}
