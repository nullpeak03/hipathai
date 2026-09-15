"use client"
import type { Phase } from "./mockData"
import { createClient } from "./supabase/client"

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

export const FRESH_GAM: Gamification = { xp: 0, level: 1, streak: 0, bestStreak: 0, passRate: 0, studyMinutes: 0, lessonsDone: 0 }
export type Gamification = { xp: number; level: number; streak: number; bestStreak: number; passRate: number; studyMinutes: number; lessonsDone: number }
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
  const url = (process.env as any).NEXT_PUBLIC_SUPABASE_URL || (process.env as any).DATABASE_URL
  const anon = (process.env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY || (process.env as any)["NEXT_PUBLIC_SUPABASE_URL/ANON"]
  return !!(url && anon)
}
export async function supabaseSaveRoadmap(userId: string, data: RoadmapData) {
  try {
    const supabase = createClient()
    const { data: roadmap, error } = await supabase.from("roadmaps").insert({
      user_id: userId, title: data.title, description: data.description, goal: data.title, lessons_total: data.totalLessons
    }).select("id").single()
    if (error) throw error
    for (const phase of data.phases) {
      const { data: p, error: pe } = await supabase.from("phases").insert({ roadmap_id: roadmap.id, idx: phase.idx, title: phase.title }).select("id").single()
      if (pe) throw pe
      for (const ls of phase.lessons) {
        await supabase.from("lessons").insert({ roadmap_id: roadmap.id, phase_id: p.id, idx: ls.idx, title: ls.title, content_md: ls.contentMd, example_code: ls.exampleCode, quiz: ls.quiz })
      }
    }
    return roadmap.id
  } catch (e) { console.warn("supabaseSaveRoadmap fallback to local", e); saveRoadmap(data); return null }
}
export async function supabaseSaveGam(userId: string, g: Gamification) {
  try { const supabase = createClient(); await supabase.from("gamification").upsert({ user_id: userId, ...g }, { onConflict: "user_id" })} catch {}
}
export async function supabaseSaveProgress(userId: string, lessonId: string, passed: boolean, score: number) {
  try { const supabase = createClient(); await supabase.from("progress").upsert({ user_id: userId, lesson_id: lessonId, completed: true, passed, score }, { onConflict: "user_id,lesson_id" })} catch {}
}
