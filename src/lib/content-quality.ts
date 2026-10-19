export type QualityIssue = { code: string; message: string }

export function validateRoadmapShape(input: unknown): QualityIssue[] {
  const issues: QualityIssue[] = []
  const data = input as { phases?: unknown[] } | null
  if (!data || !Array.isArray(data.phases) || data.phases.length === 0) {
    issues.push({ code: "no_phases", message: "Roadmap has no phases" })
    return issues
  }
  const phaseTitles = new Set<string>()
  const lessonTitles = new Set<string>()
  data.phases.forEach((phase, pi) => {
    const p = phase as { title?: unknown; lessons?: unknown[] }
    if (typeof p.title !== "string" || !p.title.trim()) issues.push({ code: "empty_phase_title", message: `Phase ${pi + 1} has no title` })
    else if (phaseTitles.has(p.title.toLowerCase())) issues.push({ code: "duplicate_phase", message: `Duplicate phase title: ${p.title}` })
    else phaseTitles.add(p.title.toLowerCase())
    if (!Array.isArray(p.lessons) || p.lessons.length === 0) issues.push({ code: "empty_phase", message: `Phase ${pi + 1} has no lessons` })
    ;(p.lessons ?? []).forEach((lesson) => {
      const l = lesson as { title?: unknown }
      if (typeof l.title !== "string" || !l.title.trim()) issues.push({ code: "empty_lesson_title", message: `A lesson in phase ${pi + 1} has no title` })
      else if (lessonTitles.has(l.title.toLowerCase())) issues.push({ code: "duplicate_lesson", message: `Duplicate lesson title: ${l.title}` })
      else lessonTitles.add(l.title.toLowerCase())
    })
  })
  return issues
}

export function deduplicateByTitle<T extends { title: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = item.title.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
