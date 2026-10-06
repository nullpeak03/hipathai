// Per-lesson code drafts (Pro editor persistence). localStorage only —
// offline-first, zero backend, guarded for SSR/test environments.

const PREFIX = "hipath_code_draft:"
const MAX_DRAFT_CHARS = 20000

export function draftKey(lessonId: string, index: number | string): string {
  return `${PREFIX}${lessonId}:${index}`
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null
    return localStorage
  } catch {
    return null
  }
}

export function loadCodeDraft(key: string): string | null {
  try {
    const v = storage()?.getItem(key)
    return typeof v === "string" && v.length > 0 ? v : null
  } catch {
    return null
  }
}

export function saveCodeDraft(key: string, code: string): void {
  try {
    if (code.length > MAX_DRAFT_CHARS) return
    storage()?.setItem(key, code)
  } catch {
    // quota/private mode — drafts are best-effort
  }
}

export function clearCodeDraft(key: string): void {
  try {
    storage()?.removeItem(key)
  } catch {
    // no-op
  }
}
