"use client"
import { generateMockRoadmap, Phase } from "./mockData"

export type RoadmapData = ReturnType<typeof generateMockRoadmap>
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

export type Gamification = { xp: number; level: number; streak: number; bestStreak: number; passRate: number; studyMinutes: number; lessonsDone: number }
export function saveGam(g: Gamification) { if (typeof window !== "undefined") localStorage.setItem(GAM_KEY, JSON.stringify(g)) }
export function loadGam(): Gamification {
  if (typeof window === "undefined") return { xp: 250, level: 3, streak: 8, bestStreak: 12, passRate: 67, studyMinutes: 45, lessonsDone: 5 }
  const raw = localStorage.getItem(GAM_KEY)
  if (!raw) return { xp: 250, level: 3, streak: 8, bestStreak: 12, passRate: 67, studyMinutes: 45, lessonsDone: 5 }
  try { return JSON.parse(raw) } catch { return { xp: 250, level: 3, streak: 8, bestStreak: 12, passRate: 67, studyMinutes: 45, lessonsDone: 5 } }
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
