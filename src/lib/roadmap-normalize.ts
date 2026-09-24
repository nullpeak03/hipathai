import { normalizeQuizQuestions } from "./quiz"
import type { LessonSpec, PhaseSpec, RoadmapSpec } from "./mockData"

/** Balanced {...} spans, string/escape aware (braces inside strings ignored). */
function balancedSpans(s: string): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = []
  let depth = 0
  let start = -1
  let inStr = false
  let esc = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === "\\") esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === "{") {
      if (depth === 0) start = i
      depth++
    } else if (c === "}") {
      if (depth > 0) {
        depth--
        if (depth === 0 && start >= 0) {
          spans.push({ start, end: i + 1 })
          start = -1
        }
      }
    }
  }
  return spans
}

/**
 * Extract the most plausible top-level JSON object from model output that
 * may be wrapped in fences, thinking traces, or trailing commentary.
 * Tries the largest balanced span first; a span must parse AND contain one
 * of `mustHave` array keys (when given) — this rejects fragments like a
 * single lesson object. Returns the JSON string or null.
 */
export function extractJsonObject(content: string, mustHave: string[] = []): string | null {
  if (!content) return null
  const spans = balancedSpans(content).sort((a, b) => (b.end - b.start) - (a.end - a.start))
  for (const sp of spans) {
    const cand = content.slice(sp.start, sp.end)
    try {
      const parsed = JSON.parse(cand) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        if (mustHave.length === 0) return cand
        const rec = parsed as Record<string, unknown>
        if (mustHave.some((k) => Array.isArray(rec[k]))) return cand
      }
    } catch {
      // try the next span
    }
  }
  return null
}

// Defensive normalization for AI-generated roadmaps — Nemotron 3 Ultra sole-source.
// Ultra decides all phrasing. This normalizer keeps only minimal hygiene:
// non-empty, length-capped titles; no word-count or numbering filters.
// Returns null only when nothing usable exists (caller fails the job, never templates).

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
      // Ultra owns phrasing — accept any non-empty title verbatim
      const objective =
        typeof lr.objective === "string"
          ? lr.objective.trim().slice(0, 500)
          : typeof lr.description === "string"
            ? lr.description.trim().slice(0, 500)
            : ""
      const quiz = normalizeQuizQuestions(lr.quiz) ?? undefined
      lessons.push(quiz ? { title, objective, quiz } : { title, objective })
    }
    if (lessons.length === 0) continue
    const phaseTitle = cleanTitle(rec.title, `Phase ${pi + 1}`)
    phases.push({ title: phaseTitle, lessons })
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
