// Single shared prompt builder for AI roadmap generation.
// Used by both the sync endpoint (api/roadmaps) and the async Inngest
// function so they produce the same 5-phase / ~40-lesson shape.

export type RoadmapPromptInput = {
  goal: string
  level?: string
  time?: string
  duration?: string
}

export const ROADMAP_JSON_SYSTEM =
  "You are a JSON generator. Output ONLY valid JSON. No explanations, no markdown, no extra text."

export function buildRoadmapPrompt({ goal, level = "Beginner", time = "1hr/day", duration = "8 weeks" }: RoadmapPromptInput): string {
  return `Generate a CS roadmap for goal "${goal}". Level: ${level}, Time: ${time}, Duration: ${duration}. Create EXACTLY 5 phases with ~40 lessons total. Each lesson title must be UNIQUE and goal-specific (not "Lesson X"). Each lesson needs an "objective": a concise sentence (8-12 words) describing what the learner will achieve. Return ONLY valid JSON: {title, description, phases:[{title, lessons:[{title, objective}]}]} No explanatory text, no markdown fences, no "Here's a thinking process:" prefix.`
}
