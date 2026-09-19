import { isValidQuiz } from "./quiz"
import type { LessonSpec, PhaseSpec, RoadmapSpec } from "./mockData"

// Defensive normalization for AI-generated roadmaps. Models improvise:
// verified 2026-09-19 that gpt-oss-20b returns
// {goal, level, time_per_day, duration_weeks, total_lessons, phases}
// with NO title/description. Without this, one missing key becomes a
// NOT NULL violation and a failed run. Returns null only when nothing
// usable exists (caller falls back to a template roadmap, never throws).

function cleanTitle(v: unknown, fallback: string): string {
  if (typeof v === "string" && v.trim().length > 0) return v.trim().slice(0, 200)
  return fallback
}

export function normalizeRoadmapJson(
  input: unknown,
  meta: { goal: string; level: string; duration: string }
): RoadmapSpec | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null
  const obj = input as Record<string, unknown>
  const rawPhases = Array.isArray(obj.phases) ? obj.phases : null
  if (!rawPhases || rawPhases.length === 0) return null

  const phases: PhaseSpec[] = []
  for (let pi = 0; pi < rawPhases.length; pi++) {
    const rp = rawPhases[pi]
    if (!rp || typeof rp !== "object" || Array.isArray(rp)) continue
    const rec = rp as Record<string, unknown>
    const rawLessons = Array.isArray(rec.lessons) ? rec.lessons : []
    const lessons: LessonSpec[] = []
    for (const rl of rawLessons) {
      if (!rl || typeof rl !== "object" || Array.isArray(rl)) continue
      const lr = rl as Record<string, unknown>
      if (typeof lr.title !== "string" || lr.title.trim().length === 0) continue
      const title = lr.title.trim().slice(0, 200)
      const objective =
        typeof lr.objective === "string"
          ? lr.objective
          : typeof lr.description === "string"
            ? lr.description
            : ""
      const quiz = isValidQuiz(lr.quiz) ? lr.quiz : undefined
      lessons.push(quiz ? { title, objective, quiz } : { title, objective })
    }
    if (lessons.length === 0) continue
    phases.push({ title: cleanTitle(rec.title, `Phase ${pi + 1}`), lessons })
  }
  if (phases.length === 0) return null

  const rawTitle = obj.title
  const title = cleanTitle(rawTitle, `Roadmap for ${meta.goal}`)
  const rawDesc = obj.description
  const description =
    typeof rawDesc === "string" && rawDesc.trim().length > 0
      ? rawDesc
      : `A ${meta.duration} roadmap for ${meta.goal} at ${meta.level} level`
  return { title, description, phases }
}
