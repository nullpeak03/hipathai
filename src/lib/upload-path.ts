// Storage path construction for learner uploads.
//
// The upload route hands the browser a signed PUT URL, so the object name it
// returns is the only place the server can keep paths well formed. Callers
// used to pass `fileName` straight through: a non-string crashed the route,
// and a very long name produced a path that the chat validator (>512 chars)
// later rejected — an upload that could never be used.

export const MAX_UPLOAD_FILE_NAME_CHARS = 60

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
}

export function extensionForContentType(contentType: string): string | null {
  return EXTENSION_BY_CONTENT_TYPE[contentType] ?? null
}

/**
 * Reduce a user-supplied name to a safe stem: no directory separators, no
 * duplicate extension, bounded length. Falls back to "image" when nothing
 * usable remains.
 */
export function safeFileNameStem(fileName: unknown): string {
  if (typeof fileName !== "string") return "image"
  const withoutPath = fileName.split(/[\\/]/).pop() ?? ""
  const withoutExtension = withoutPath.replace(/\.[A-Za-z0-9]{1,8}$/, "")
  const cleaned = withoutExtension.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^[._-]+/, "")
  if (cleaned.length === 0) return "image"
  return cleaned.slice(0, MAX_UPLOAD_FILE_NAME_CHARS)
}

/**
 * Build the object key stored in the private `tutor-images` bucket:
 * `{clerkId}/{timestamp}-{nonce}-{stem}.{ext}`.
 *
 * The extension comes from the declared content type, never from the file
 * name, so the stored object's type always matches what the bucket allows.
 */
export function buildTutorImagePath(input: {
  userId: string
  fileName: unknown
  contentType: string
  now?: number
  nonce?: string
}): string {
  const extension = extensionForContentType(input.contentType)
  if (!extension) throw new Error(`Unsupported content type: ${input.contentType}`)
  const now = input.now ?? Date.now()
  const nonce = (input.nonce ?? Math.random().toString(36).slice(2, 10)).replace(/[^a-z0-9]/gi, "").slice(0, 8) || "x"
  return `${input.userId}/${now}-${nonce}-${safeFileNameStem(input.fileName)}.${extension}`
}
