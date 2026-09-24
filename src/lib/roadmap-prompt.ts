// Single shared prompt builder for AI roadmap generation — delegated entirely to Nemotron 3 Ultra.
// Used by both the sync endpoint (api/roadmaps) and the async Inngest function.
// Sizing hints (time/duration) are provided as guidance only; Ultra decides all
// titles, lesson counts per phase, and objective phrasing. No hard-coded Week
// prefixes, word-count limits, or title templates — Ultra owns naming.

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
  return `You are Nemotron 3 Ultra, an expert curriculum designer. Generate a personalized roadmap for goal "${goal}". Level: ${level}, Time: ${time}, Duration: ${duration}.${motivation} You decide all phase and lesson titles — make them specific to the goal, natural phrasing, unique across the roadmap, no templated prefixes. You decide how many lessons per phase and the objective wording for each lesson — pace so earlier phases build foundations, middle phases practice, final phases synthesize. Order lessons so later ones build on earlier (prerequisites). Sizing hint (not a constraint): about ${phases} phases and ~${lessons} lessons is a reasonable fit for this schedule, but you own the final counts.${styleSection(styles)} Return ONLY valid JSON: {title, description, phases:[{title, lessons:[{title, objective}]}]} No explanatory text, no markdown fences, no "Here's a thinking process:" prefix.`
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

/** Small planning call: roadmap title, description, and phase titles only — Ultra decides all titles. */
export function buildOutlinePrompt({ goal, level = "Beginner", time = "1hr/day", duration = "8 weeks", why, styles, phases }: OutlinePromptInput): string {
  const motivation = why && why.trim().length > 0 ? ` Motivation: ${why.trim().slice(0, 200)}.` : ""
  return `You are Nemotron 3 Ultra, an expert curriculum designer. Plan a personalized roadmap for goal "${goal}". Level: ${level}, Time: ${time}, Duration: ${duration}.${motivation} You decide all phase titles — make them specific to the goal, natural phrasing, unique, in logical learning dependency order. Sizing hint: about ${phases} phases is a reasonable fit for this schedule, but you own the final count. Arrange so earlier phases build foundations, later phases synthesize.${styleSection(styles)} Return ONLY valid JSON: {title, description, phases:[{title}]} No explanatory text, no markdown fences, no "Here's a thinking process:" prefix.`
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

/** Expand ONE phase into its lessons — Ultra decides lesson titles, counts, and objectives. */
export function buildPhasePrompt({ goal, level = "Beginner", time = "1hr/day", duration = "8 weeks", why, styles, phaseIndex, phaseCount, phaseTitle, lessonCount }: PhasePromptInput): string {
  const motivation = why && why.trim().length > 0 ? ` Motivation: ${why.trim().slice(0, 200)}.` : ""
  return `You are Nemotron 3 Ultra, an expert curriculum designer. You are expanding phase ${phaseIndex} of ${phaseCount} (phase "${phaseTitle}") of a personalized roadmap for goal "${goal}". Level: ${level}, Time: ${time}, Duration: ${duration}.${motivation} You decide all lesson titles and objectives for THIS phase only — natural, goal-specific phrasing, unique within the phase, ordered so later lessons build on earlier (prerequisites). Sizing hint: about ${lessonCount} lessons is reasonable for this phase, but you own the final count and objective wording.${styleSection(styles)} Return ONLY valid JSON: {title, lessons:[{title, objective}]} No explanatory text, no markdown fences, no "Here's a thinking process:" prefix.`
}
