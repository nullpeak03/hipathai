// Single shared prompt builder for AI roadmap generation.
// Used by both the sync endpoint (api/roadmaps) and the async Inngest
// function. Phase/lesson counts come from planRoadmapSize (derived from the
// learner's level, daily time, and duration) — never hardcoded.

export type RoadmapPromptInput = {
  goal: string
  level?: string
  time?: string
  duration?: string
  phases: number
  lessons: number
  why?: string
}

export const ROADMAP_JSON_SYSTEM =
  "You are a JSON generator. Output ONLY valid JSON. No explanations, no markdown, no extra text."

export function buildRoadmapPrompt({ goal, level = "Beginner", time = "1hr/day", duration = "8 weeks", phases, lessons, why }: RoadmapPromptInput): string {
  const motivation = why && why.trim().length > 0 ? ` Motivation: ${why.trim().slice(0, 200)}.` : ""
  return `Generate a CS roadmap for goal "${goal}". Level: ${level}, Time: ${time}, Duration: ${duration}.${motivation} Create EXACTLY ${phases} phases with ~${lessons} lessons total. Each lesson title must be UNIQUE and goal-specific (not "Lesson X"). Each lesson needs an "objective": a concise sentence (8-12 words) describing what the learner will achieve. Return ONLY valid JSON: {title, description, phases:[{title, lessons:[{title, objective}]}]} No explanatory text, no markdown fences, no "Here's a thinking process:" prefix.`
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
  phases: number
}

/** Small planning call: roadmap title, description, and phase titles only. */
export function buildOutlinePrompt({ goal, level = "Beginner", time = "1hr/day", duration = "8 weeks", why, phases }: OutlinePromptInput): string {
  const motivation = why && why.trim().length > 0 ? ` Motivation: ${why.trim().slice(0, 200)}.` : ""
  return `Plan a CS roadmap for goal "${goal}". Level: ${level}, Time: ${time}, Duration: ${duration}.${motivation} Create EXACTLY ${phases} phases in a logical learning order with UNIQUE, goal-specific phase titles (not "Phase X"). Return ONLY valid JSON: {title, description, phases:[{title}]} No explanatory text, no markdown fences, no "Here's a thinking process:" prefix.`
}

export type PhasePromptInput = {
  goal: string
  level?: string
  time?: string
  duration?: string
  why?: string
  phaseIndex: number
  phaseCount: number
  phaseTitle: string
  lessonCount: number
}

/** Expand ONE phase into its lessons. Kept small so no single AI step can
 *  approach serverless execution limits. */
export function buildPhasePrompt({ goal, level = "Beginner", time = "1hr/day", duration = "8 weeks", why, phaseIndex, phaseCount, phaseTitle, lessonCount }: PhasePromptInput): string {
  const motivation = why && why.trim().length > 0 ? ` Motivation: ${why.trim().slice(0, 200)}.` : ""
  return `You are expanding phase ${phaseIndex} of ${phaseCount} ("${phaseTitle}") of a CS roadmap for goal "${goal}". Level: ${level}, Time: ${time}, Duration: ${duration}.${motivation} Generate EXACTLY ${lessonCount} lessons for THIS phase only, in learning order. Each lesson title must be UNIQUE and goal-specific (not "Lesson X"). Each lesson needs an "objective": a concise sentence (8-12 words) describing what the learner will achieve. Return ONLY valid JSON: {title, lessons:[{title, objective}]} No explanatory text, no markdown fences, no "Here's a thinking process:" prefix.`
}
