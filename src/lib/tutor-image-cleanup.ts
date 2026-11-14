// Best-effort removal of a learner's uploaded images.
//
// Objects live in the private `tutor-images` bucket under `{clerkId}/...`.
// Deleting the `users` row cascades rows but never touches Storage, so
// without this step a deleted account left its screenshots behind forever.

export type StorageListEntry = { name: string }
export type StorageListResult = { data: StorageListEntry[] | null; error: { message: string } | null }
export type StorageRemoveResult = { error: { message: string } | null }

/** The slice of the Supabase storage client this module needs (mockable). */
export type TutorImageStorage = {
  from: (bucket: string) => {
    list: (prefix: string, options: { limit: number; offset: number }) => Promise<StorageListResult>
    remove: (paths: string[]) => Promise<StorageRemoveResult>
  }
}

export type CleanupResult = { ok: boolean; deleted: number; error?: string }

export const CLEANUP_PAGE_SIZE = 100
export const CLEANUP_MAX_PAGES = 50

/**
 * Turn a page of storage entries into object paths, dropping anything that is
 * not a plain file name (folders, traversal, empty names).
 */
export function toObjectPaths(userId: string, entries: StorageListEntry[] | null): string[] {
  const paths: string[] = []
  for (const entry of entries ?? []) {
    const name = typeof entry?.name === "string" ? entry.name : ""
    if (!name || name === "." || name === ".." || name.includes("/")) continue
    paths.push(`${userId}/${name}`)
  }
  return paths
}

/**
 * Delete every object under `{userId}/`. Paginates because `list()` is capped
 * per call. Any failure is reported, never thrown: the caller decides whether
 * to continue with account deletion.
 */
export async function deleteTutorImagesForUser(
  storage: TutorImageStorage,
  userId: string,
  options: { pageSize?: number; maxPages?: number; bucket?: string } = {}
): Promise<CleanupResult> {
  const bucket = options.bucket ?? "tutor-images"
  const pageSize = options.pageSize ?? CLEANUP_PAGE_SIZE
  const maxPages = options.maxPages ?? CLEANUP_MAX_PAGES
  let deleted = 0

  try {
    for (let page = 0; page < maxPages; page++) {
      const { data, error } = await storage.from(bucket).list(userId, {
        limit: pageSize,
        offset: page * pageSize,
      })
      if (error) return { ok: false, deleted, error: error.message }

      const paths = toObjectPaths(userId, data)
      if (paths.length === 0) return { ok: true, deleted }

      const removal = await storage.from(bucket).remove(paths)
      if (removal.error) return { ok: false, deleted, error: removal.error.message }
      deleted += paths.length

      // Fewer objects than a full page means this was the last page; offset
      // does not need to advance past removed rows.
      if ((data?.length ?? 0) < pageSize) return { ok: true, deleted }
    }
    return { ok: false, deleted, error: "Too many stored images to clean up in one pass." }
  } catch (e) {
    return { ok: false, deleted, error: e instanceof Error ? e.message : String(e) }
  }
}
