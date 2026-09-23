// Single shared prompt builder for AI roadmap generation.
// Used by both the sync endpoint (api/roadmaps) and the async Inngest
// function. Phase/lesson counts come from planRoadmapSize (derived from the
// learner's level, daily time, and duration) — never hardcoded.

import { buildStyleGuidance } from "./style-guidance"

export type RoadmapPromptInput = {
  goal: string
  level?: string
  time?: string
  duration?: string
  phases: number
  lessons: number
  why?: string
  styles?: string | string[]
}

export const ROADMAP_JSON_SYSTEM =
  "You are a JSON generator. Output ONLY valid JSON. No explanations, no markdown, no extra text."
function styleSection(styles: string | string[] | undefined): string {
  const blend = buildStyleGuidance(styles)
  return blend ? ` Shape the roadmap to these learning styles:
${blend}` : ""
}

export function buildRoadmapPrompt({ goal, level = "Beginner", time = "1hr/day", duration = "8 weeks", phases, lessons, why, styles }: RoadmapPromptInput): string {
  const motivation = why && why.trim().length > 0 ? ` Motivation: ${why.trim().slice(0, 200)}.` : ""
  return `Generate a personalized roadmap for goal "${goal}". Level: ${level}, Time: ${time}, Duration: ${duration} (${phases} weeks).${motivation} Create EXACTLY ${phases} weekly phases (Week 1 to Week ${phases}) with ~${lessons} lessons total, paced so earlier weeks = foundations, middle = practice, final = synthesis. Phase titles must be concept phrases like "Python Foundations": 2–3 words, Title Case, no numbering. Lesson titles must be like "Python Syntax", "Python Variables", "Python Data Types" — 2–3 words, prefixed with the goal keyword when natural, Title Case, no numbering ("Lesson X"), unique across roadmap. Each lesson needs an "objective": a concise sentence (8-12 words). Each lesson is ~10 minutes, order so later lessons build on earlier (prerequisites).${styleSection(styles)} Return ONLY valid JSON: {title, description, phases:[{title, lessons:[{title, objective}]}]} No explanatory text, no markdown fences, no "Here's a thinking process:" prefix.`
}

/**
 * Split a lesson total across phases as evenly as possible (remainder goes
 * to the earliest phases). Sum of the result always equals total.
 */
export function distributeLessons(total: number, phases: number): number[] {
  if (phases <= 0) return []
  const safeTotal = Math.max(0, Math.floor(total))
  const base = Math.floor(safeTotal / phases)
  const remainder = safeTotal % phases
  return Array.from({ length: phases }, (_, i) => base + (i < remainder ? 1 : 0))
}

export type OutlinePromptInput = {
  goal: string
  level?: string
  time?: string
  duration?: string
  why?: string
  styles?: string | string[]
  phases: number
}

/** Small planning call: roadmap title, description, and phase titles only. */
export function buildOutlinePrompt({ goal, level = "Beginner", time = "1hr/day", duration = "8 weeks", why, styles, phases }: OutlinePromptInput): string {
  const motivation = why && why.trim().length > 0 ? ` Motivation: ${why.trim().slice(0, 200)}.` : ""
  return `Plan a personalized roadmap for goal "${goal}". Level: ${level}, Time: ${time}, Duration: ${duration} (${phases} weeks).${motivation} Create EXACTLY ${phases} weekly phases (Week 1 to Week ${phases}) in logical learning dependency order. Phase titles must be concept phrases like "Python Foundations", "Core Data Structures": 2–3 words, Title Case, no numbering, goal-specific and unique, e.g. for Python: "Python Foundations".${styleSection(styles)} Return ONLY valid JSON: {title, description, phases:[{title}]} No explanatory text, no markdown fences, no "Here's a thinking process:" prefix.`
}

export type PhasePromptInput = {
  goal: string
  level?: string
  time?: string
  duration?: string
  why?: string
  styles?: string | string[]
  phaseIndex: number
  phaseCount: number
  phaseTitle: string
  lessonCount: number
}

/** Expand ONE phase into its lessons. Kept small so no single AI step can
 *  approach serverless execution limits. */
export function buildPhasePrompt({ goal, level = "Beginner", time = "1hr/day", duration = "8 weeks", why, styles, phaseIndex, phaseCount, phaseTitle, lessonCount }: PhasePromptInput): string {
  const motivation = why && why.trim().length > 0 ? ` Motivation: ${why.trim().slice(0, 200)}.` : ""
  return `You are expanding Week ${phaseIndex} of ${phaseCount} (phase "${phaseTitle}") of a personalized roadmap for goal "${goal}". Level: ${level}, Time: ${time}, Duration: ${duration}.${motivation} Generate EXACTLY ${lessonCount} lessons for THIS week only, in learning order where each lesson builds on previous (prerequisites). Lesson titles must be like "Python Syntax", "Python Variables", "Python Data Types" — 2–3 words, prefixed with the goal keyword when natural, Title Case, no numbering, unique. Each lesson needs an "objective": a concise sentence (8-12 words). Each lesson is ~10 minutes.${styleSection(styles)} Return ONLY valid JSON: {title, lessons:[{title, objective}]} No explanatory text, no markdown fences, no "Here's a thinking process:" prefix.`
}
