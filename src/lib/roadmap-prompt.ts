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
}

export const ROADMAP_JSON_SYSTEM =
  "You are a JSON generator. Output ONLY valid JSON. No explanations, no markdown, no extra text."

export function buildRoadmapPrompt({ goal, level = "Beginner", time = "1hr/day", duration = "8 weeks", phases, lessons }: RoadmapPromptInput): string {
  return `Generate a CS roadmap for goal "${goal}". Level: ${level}, Time: ${time}, Duration: ${duration}. Create EXACTLY ${phases} phases with ~${lessons} lessons total. Each lesson title must be UNIQUE and goal-specific (not "Lesson X"). Each lesson needs an "objective": a concise sentence (8-12 words) describing what the learner will achieve. Return ONLY valid JSON: {title, description, phases:[{title, lessons:[{title, objective}]}]} No explanatory text, no markdown fences, no "Here's a thinking process:" prefix.`
}
