// Public roadmap library (SEO): canonical syllabi at /roadmaps/[slug].
// Slugs are lowercase alphanumerics + hyphens (mirrors the DB check).

export type PublicPhase = {
  title: string
  lessons: { title: string; objective: string }[]
}

export type PublicRoadmap = {
  id: string
  slug: string
  title: string
  description: string
  goal: string
  level: string
  syllabus: { phases: PublicPhase[] }
  clones_count: number
  published_at: string
}

/** "Learn Python from Scratch!" -> "learn-python-from-scratch" */
export function slugifyTopic(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
  return slug.slice(0, 80) || "roadmap"
}

/** Guard a syllabus payload before render/persist (never trust raw JSONB). */
export function isValidSyllabus(input: unknown): input is { phases: PublicPhase[] } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false
  const { phases } = input as { phases?: unknown }
  if (!Array.isArray(phases) || phases.length === 0) return false
  return phases.every((p) => {
    if (!p || typeof p !== "object" || Array.isArray(p)) return false
    const rec = p as Record<string, unknown>
    if (typeof rec.title !== "string" || rec.title.trim().length === 0) return false
    if (!Array.isArray(rec.lessons) || rec.lessons.length === 0) return false
    return (rec.lessons as unknown[]).every((l) => {
      if (!l || typeof l !== "object" || Array.isArray(l)) return false
      const lr = l as Record<string, unknown>
      return typeof lr.title === "string" && lr.title.trim().length > 0
    })
  })
}

/** Total lessons across all phases (for meta copy + stats). */
export function countSyllabusLessons(syllabus: { phases: PublicPhase[] }): number {
  return syllabus.phases.reduce((a, p) => a + p.lessons.length, 0)
}
