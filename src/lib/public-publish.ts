import { createServerClient } from "./supabase/server"
import { slugifyTopic } from "./public-roadmaps"

// Auto-publish: when a user-generated roadmap covers a topic missing from
// the public library, a scrubbed copy (titles + objectives only — never
// user identity) is published. Best-effort: failures never fail the job.

// Generic filler stripped before topic comparison ("Learn X from scratch"
// and "X" are the same topic; "career switch" vs plain is kept distinct).
const FILLER = new Set([
  "learn", "learning", "from", "scratch", "beginning", "beginner", "complete",
  "full", "course", "tutorial", "tutorials", "guide", "master", "mastering",
  "masterclass", "crash", "introduction", "intro", "basics", "fundamentals",
  "essentials", "ultimate", "a", "an", "the", "to", "for", "with", "in", "on", "of",
])

function singularize(t: string): string {
  // "agents" -> "agent" so plurals match; conservative to avoid mangling.
  return t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t
}

function tokensOf(goal: string): string[] {
  return goal
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !FILLER.has(t))
    .map(singularize)
}

/** Canonical topic key: filler-free tokens joined ("" when nothing remains). */
export function normalizeTopic(goal: string): string {
  return tokensOf(goal).join("-")
}

/**
 * Same-topic test: exact normalized match, subset within one token
 * ("Django with Python" vs "Python Django Developer"), or token-set
 * Jaccard >= 0.75. Intent words (career, job, interview) stay distinct:
 * "DSA" vs "DSA for Career Switch" are different library entries.
 */
export function topicsMatch(a: string, b: string): boolean {
  const na = normalizeTopic(a)
  const nb = normalizeTopic(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const sa = new Set(na.split("-"))
  const sb = new Set(nb.split("-"))
  const [smaller, larger] = sa.size <= sb.size ? [sa, sb] : [sb, sa]
  let subset = true
  for (const t of smaller) {
    if (!larger.has(t)) {
      subset = false
      break
    }
  }
  if (subset && larger.size - smaller.size <= 1) return true
  let inter = 0
  for (const t of sa) if (sb.has(t)) inter++
  return inter / (sa.size + sb.size - inter) >= 0.75
}

function objectiveOf(contentMd: string | null): string {
  const lines = String(contentMd ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  return (lines.find((l) => !l.startsWith("#")) || "").slice(0, 220)
}

/**
 * Publish a finished user roadmap to the public library when its topic is
 * not already covered. Returns the slug, "duplicate", "thin", or null on
 * any failure (caller must never fail because of this).
 */
export async function maybePublishRoadmap(roadmapId: string): Promise<string | null> {
  try {
    const supabase = createServerClient()
    const { data: roadmap } = await supabase
      .from("roadmaps")
      .select("id,title,description,goal,level")
      .eq("id", roadmapId)
      .single()
    const rm = roadmap as {
      id: string
      title: string | null
      description: string | null
      goal: string | null
      level: string | null
    } | null
    if (!rm || !rm.goal) return null
    const { data: phases } = await supabase
      .from("phases")
      .select("id,idx,title")
      .eq("roadmap_id", roadmapId)
      .order("idx")
    const phaseRows = ((phases ?? []) as { id: string; title: string }[]).filter((p) => p.title)
    const syllabus = { phases: [] as { title: string; lessons: { title: string; objective: string }[] }[] }
    for (const p of phaseRows) {
      const { data: lessons } = await supabase
        .from("lessons")
        .select("title,content_md")
        .eq("roadmap_id", roadmapId)
        .eq("phase_id", p.id)
        .order("idx")
        .limit(100)
      const clean = ((lessons ?? []) as { title: string; content_md: string | null }[])
        .filter((l) => l.title && !/part\s+\d+\s*$/i.test(l.title))
        .map((l) => ({ title: l.title.trim().slice(0, 120), objective: objectiveOf(l.content_md) }))
      if (clean.length > 0) syllabus.phases.push({ title: p.title, lessons: clean })
    }
    const total = syllabus.phases.reduce((a, p) => a + p.lessons.length, 0)
    // Quality gate: thin or empty generations stay private.
    if (syllabus.phases.length < 2 || total < 4) return "thin"
    // Dedupe against existing library topics.
    const { data: existing } = await supabase.from("public_roadmaps").select("goal").limit(500)
    const goals = ((existing ?? []) as { goal: string }[]).map((r) => r.goal)
    if (goals.some((g) => topicsMatch(g, rm.goal!))) return "duplicate"
    // Unique slug (suffix on the rare collision).
    const base = slugifyTopic(normalizeTopic(rm.goal).replace(/-/g, " ") || rm.goal)
    let slug = base
    for (let i = 2; i <= 5; i++) {
      const { data: clash } = await supabase.from("public_roadmaps").select("id").eq("slug", slug).limit(1)
      if (!clash || (clash as unknown[]).length === 0) break
      slug = `${base}-${i}`
    }
    const desc = (rm.description ?? "").trim()
    const description = desc.length >= 80 && desc.length <= 320
      ? desc
      : `${rm.title ?? rm.goal} — a week-by-week roadmap (${syllabus.phases.length} phases, ${total} lessons, free).`
    const { error } = await supabase.from("public_roadmaps").insert({
      slug,
      title: (rm.title ?? rm.goal).slice(0, 200),
      description: description.slice(0, 320),
      goal: rm.goal,
      level: rm.level ?? "Beginner",
      syllabus,
      source_roadmap_id: roadmapId,
    })
    if (error) throw error
    console.log(`[publish] auto-published ${slug}: ${syllabus.phases.length} phases, ${total} lessons`)
    return slug
  } catch (e) {
    console.warn("[publish] auto-publish skipped:", e instanceof Error ? e.message.slice(0, 160) : e)
    return null
  }
}
