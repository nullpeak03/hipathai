export type CapstoneEvidenceRecord = {
  id: string
  roadmap_id: string
  lesson_id: string
  project_summary: string
  repository_url: string | null
  deployment_url: string | null
  implementation_complete: boolean
  validation_complete: boolean
  documentation_complete: boolean
  reflection: string
  updated_at: string
}

export function isCapstoneTitle(title: string): boolean {
  return /capstone|final project|culminating/i.test(title)
}

export function isAllowedEvidenceUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  if (trimmed.length > 2048) return false
  try {
    const url = new URL(trimmed)
    return (url.protocol === "https:" || url.protocol === "http:")
      && !url.username
      && !url.password
  } catch {
    return false
  }
}
