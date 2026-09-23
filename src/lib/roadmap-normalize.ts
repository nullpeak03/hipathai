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

function isConceptPhrase(title: string): boolean {
  const wc = title.trim().split(/\s+/).length
  if (wc < 1 || wc > 6) return false
  if (/^(lesson|phase)\s*\d+/i.test(title)) return false
  return true
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
      let title = lr.title.trim().slice(0, 200)
      // Strict concept phrase: 2–5 words, no Lesson X numbering (keeps "Introduction and Syntax")
      if (!isConceptPhrase(title)) continue
      // Title Case normalization (preserve user cap but ensure first letter upper)
      title = title.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      const objective =
        typeof lr.objective === "string"
          ? lr.objective
          : typeof lr.description === "string"
            ? lr.description
            : ""
      const quiz = normalizeQuizQuestions(lr.quiz) ?? undefined
      lessons.push(quiz ? { title, objective, quiz } : { title, objective })
    }
    if (lessons.length === 0) continue
    let phaseTitle = cleanTitle(rec.title, `Phase ${pi + 1}`)
    if (!isConceptPhrase(phaseTitle)) phaseTitle = `Phase ${pi + 1}`
    else phaseTitle = phaseTitle.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
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
