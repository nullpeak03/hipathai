// Supabase config guards — fail loud with an actionable message instead of
// letting garbage values (wrongly pasted secrets, JSON blobs) cause
// mysterious downstream failures.

export function isHttpUrl(value: string | undefined): boolean {
  if (!value) return false
  try {
    const u = new URL(value)
    return u.protocol === "https:" || u.protocol === "http:"
  } catch {
    return false
  }
}
