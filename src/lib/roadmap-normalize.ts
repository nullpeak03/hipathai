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

// Defensive normalization for AI-generated roadmaps — Nemotron sole-source.
// The model owns phrasing, but two failure modes are repaired deterministically
// (seen live in prod: "{Phase} — Part N" lesson loops and 9-word colon titles):
// numbered suffixes are stripped and verbose titles are cut at the first
// colon/semicolon and capped at 5 words, so every title ships image-style
// ("Python Syntax"). Returns null only when nothing usable exists (caller
// fails the job, never templates).

function cleanTitle(v: unknown, fallback: string): string {
  if (typeof v === "string" && v.trim().length > 0) return v.trim().slice(0, 200)
  return fallback
}

/** Repair a phase/lesson title into concept-phrase shape ("Python Syntax"). */
export function repairTitle(v: unknown, fallback: string): string {
  let t = typeof v === "string" ? v.trim() : ""
  if (!t) return fallback
  // "Python Foundations — Part 1" -> "Python Foundations"
  t = t.replace(/\s*[—–-]\s*part\s*\d+\s*$/i, "").trim()
  t = t.replace(/\s*\b(part|lesson|step|phase|module|unit)\s*\d+\s*$/i, "").trim()
  // "Core Python Foundations: Syntax, Data Types..." -> "Core Python Foundations"
  const cut = t.search(/[:;]/)
  if (cut > 0) t = t.slice(0, cut).trim()
  t = t.replace(/,.*$/, "").trim()
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length > 5) t = words.slice(0, 5).join(" ")
  t = t.trim()
  return (t || fallback).slice(0, 120)
}

export function normalizeRoadmapJson(
  input: unknown,
  meta: { goal: string; level: string; duration: string }
): RoadmapSpec | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null
  const obj = input as Record<string, unknown>
  // Accept both the full roadmap shape {phases:[...]} and the bare phase
  // shape {title, lessons:[...]} returned by single-phase expansion calls.
  const rawPhases = Array.isArray(obj.phases)
    ? obj.phases
    : Array.isArray(obj.lessons)
      ? [obj]
      : null
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
      const title = repairTitle(lr.title, "")
      if (!title) continue
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
    const phaseTitle = repairTitle(rec.title, `Phase ${pi + 1}`)
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
