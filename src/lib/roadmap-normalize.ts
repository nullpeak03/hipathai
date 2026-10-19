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

/**
 * Extract usable phase titles from an outline payload, tolerating the shapes
 * models actually emit: [{title}], bare string arrays (["A", "B"]), and
 * {name} keys. Empty/blank entries are dropped. Never throws.
 */
export function extractOutlineTitles(input: unknown): string[] {
  if (!input || typeof input !== "object" || Array.isArray(input)) return []
  const raw = (input as Record<string, unknown>).phases
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const p of raw) {
    if (typeof p === "string") {
      if (p.trim().length > 0) out.push(p.trim().slice(0, 200))
      continue
    }
    if (p && typeof p === "object" && !Array.isArray(p)) {
      const rec = p as Record<string, unknown>
      const t = rec.title ?? rec.name
      if (typeof t === "string" && t.trim().length > 0) out.push(t.trim().slice(0, 200))
    }
  }
  return out
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
  const allLessonTitles = new Set<string>()
  const allPhaseTitles = new Set<string>()
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
      // Anti-duplication: reject duplicate lesson titles globally
      if (allLessonTitles.has(title.toLowerCase())) continue
      allLessonTitles.add(title.toLowerCase())
      const objective =
        typeof lr.objective === "string"
          ? lr.objective.trim().slice(0, 500)
          : typeof lr.description === "string"
            ? lr.description.trim().slice(0, 500)
            : ""
      const quiz = normalizeQuizQuestions(lr.quiz) ?? undefined
      const estimatedMinutes =
        typeof lr.estimatedMinutes === "number" && Number.isFinite(lr.estimatedMinutes)
          ? Math.max(1, Math.min(120, Math.round(lr.estimatedMinutes)))
          : undefined
      const difficultyRaw = lr.difficulty
      const difficulty =
        typeof difficultyRaw === "string" && ["beginner", "intermediate", "advanced"].includes(difficultyRaw)
          ? difficultyRaw as "beginner" | "intermediate" | "advanced"
          : undefined
      const prerequisites = Array.isArray(lr.prerequisites)
        ? lr.prerequisites.filter((p) => typeof p === "string" && p.trim().length > 0).map((p) => p.trim())
        : undefined
      lessons.push(
        quiz
          ? { title, objective, quiz, estimatedMinutes, difficulty, prerequisites }
          : { title, objective, estimatedMinutes, difficulty, prerequisites }
      )
    }
    if (lessons.length === 0) continue
    const phaseTitle = repairTitle(rec.title, `Phase ${pi + 1}`)
    // Anti-duplication: reject duplicate phase titles
    if (allPhaseTitles.has(phaseTitle.toLowerCase())) continue
    allPhaseTitles.add(phaseTitle.toLowerCase())
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

/** Quality score 0-100 for a normalized roadmap. Used as regeneration gate. */
export function roadmapQualityScore(spec: RoadmapSpec | null): number {
  if (!spec || !spec.phases || spec.phases.length === 0) return 0
  let score = 0
  const totalLessons = spec.phases.reduce((sum, p) => sum + (p.lessons?.length ?? 0), 0)
  if (totalLessons === 0) return 0
  // Phase count reasonable
  if (spec.phases.length >= 3 && spec.phases.length <= 20) score += 15
  else if (spec.phases.length >= 2) score += 8
  // Lesson count reasonable
  if (totalLessons >= 8 && totalLessons <= 200) score += 15
  else if (totalLessons >= 4) score += 8
  // All lessons have objectives
  const allLessons = spec.phases.flatMap((p) => p.lessons ?? [])
  const withObjectives = allLessons.filter((l) => l.objective && l.objective.length > 10).length
  if (withObjectives === totalLessons) score += 20
  else if (withObjectives > totalLessons * 0.8) score += 10
  // All lessons have difficulty
  const withDifficulty = allLessons.filter((l) => l.difficulty).length
  if (withDifficulty === totalLessons) score += 10
  else if (withDifficulty > totalLessons * 0.8) score += 5
  // Prerequisites reference valid titles (basic check: non-empty strings)
  const withPrereqs = allLessons.filter((l) => l.prerequisites && l.prerequisites.length > 0).length
  if (withPrereqs > 0) score += 10
  // No duplicate titles (enforced in normalize, but double-check)
  const lessonTitles = allLessons.map((l) => l.title.toLowerCase())
  const uniqueLessons = new Set(lessonTitles).size
  if (uniqueLessons === totalLessons) score += 15
  // Phase titles unique
  const phaseTitles = spec.phases.map((p) => p.title.toLowerCase())
  if (new Set(phaseTitles).size === spec.phases.length) score += 10
  // Estimated minutes present
  const withMinutes = allLessons.filter((l) => l.estimatedMinutes && l.estimatedMinutes > 0).length
  if (withMinutes === totalLessons) score += 5
  return Math.max(0, Math.min(100, score))
}

/** Quality score for RoadmapData (post-Supabase load). */
export function roadmapDataQualityScore(spec: { phases: { title: string; lessons: { title: string; objective?: string; difficulty?: string; prerequisites?: string[]; estimatedMinutes?: number | null; quiz?: unknown[] }[] }[] } | null): number {
  if (!spec || !spec.phases || spec.phases.length === 0) return 0
  let score = 0
  const totalLessons = spec.phases.reduce((sum, p) => sum + (p.lessons?.length ?? 0), 0)
  if (totalLessons === 0) return 0
  if (spec.phases.length >= 3 && spec.phases.length <= 20) score += 15
  else if (spec.phases.length >= 2) score += 8
  if (totalLessons >= 8 && totalLessons <= 200) score += 15
  else if (totalLessons >= 4) score += 8
  const allLessons = spec.phases.flatMap((p) => p.lessons ?? [])
  // Objectives/difficulty are not persisted on lessons, so score the fields that
  // actually exist in stored roadmap data instead of penalizing their absence.
  const withPrereqs = allLessons.filter((l) => l.prerequisites && l.prerequisites.length > 0).length
  if (withPrereqs > 0) score += 10
  const lessonTitles = allLessons.map((l) => l.title.toLowerCase())
  const uniqueLessons = new Set(lessonTitles).size
  if (uniqueLessons === totalLessons) score += 15
  const phaseTitles = spec.phases.map((p) => p.title.toLowerCase())
  if (new Set(phaseTitles).size === spec.phases.length) score += 10
  const withMinutes = allLessons.filter((l) => l.estimatedMinutes && l.estimatedMinutes > 0).length
  if (withMinutes === totalLessons) score += 5
  else if (withMinutes > totalLessons * 0.8) score += 3
  const withQuiz = allLessons.filter((l) => Array.isArray(l.quiz) && l.quiz.length > 0).length
  if (withQuiz === totalLessons) score += 10
  else if (withQuiz > totalLessons * 0.8) score += 5
  // Back-compat: reward richer metadata when present (older scoring).
  const withObjectives = allLessons.filter((l) => l.objective && l.objective.length > 10).length
  if (withObjectives === totalLessons) score += 10
  else if (withObjectives > totalLessons * 0.8) score += 5
  const withDifficulty = allLessons.filter((l) => l.difficulty).length
  if (withDifficulty === totalLessons) score += 5
  return Math.max(0, Math.min(100, score))
}

export type AssembledOutline = { title: string; description: string; phaseTitles: string[] }

/**
 * Build an outline from a parsed outline payload, tolerating the shapes
 * models emit (see extractOutlineTitles). Pads/truncates to the planned
 * phase count and repairs every title into concept-phrase shape. Returns
 * null when the payload carries no usable phase titles — the caller
 * regenerates or fails the job, never templates. Pure: shared by the
 * outline step and its strict-regeneration step.
 */
export function buildOutlineFromRaw(
  raw: unknown,
  meta: { goal: string; level: string; duration: string },
  plannedPhases: number
): AssembledOutline | null {
  const titles = extractOutlineTitles(raw)
  if (titles.length === 0) return null
  const doc = (raw ?? {}) as { title?: unknown; description?: unknown }
  const title =
    typeof doc.title === "string" && doc.title.trim()
      ? doc.title.trim().slice(0, 200)
      : `Roadmap for ${meta.goal}`
  const description =
    typeof doc.description === "string" && doc.description.trim()
      ? doc.description
      : `A ${meta.duration} roadmap for ${meta.goal} at ${meta.level} level`
  while (titles.length < plannedPhases) titles.push(`Phase ${titles.length + 1}`)
  const phaseTitles = titles.slice(0, plannedPhases).map((t, i) => repairTitle(t, `Phase ${i + 1}`))
  return { title, description, phaseTitles }
}
