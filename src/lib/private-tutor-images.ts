const MAX_TUTOR_IMAGES = 4

export type TutorImagePathResult =
  | { ok: true; paths: string[] }
  | { ok: false; error: string; status: 400 | 401 }

export function parseOwnedTutorImagePaths(images: unknown, userId: string | null): TutorImagePathResult {
  if (images === undefined || images === null) return { ok: true, paths: [] }
  if (!Array.isArray(images)) return { ok: false, error: "Attached images are invalid.", status: 400 }
  if (images.length === 0) return { ok: true, paths: [] }
  if (images.length > MAX_TUTOR_IMAGES) {
    return { ok: false, error: `Attach between 1 and ${MAX_TUTOR_IMAGES} images.`, status: 400 }
  }
  if (!userId) return { ok: false, error: "Sign in before attaching images.", status: 401 }

  const paths: string[] = []
  for (const path of images) {
    if (typeof path !== "string" || path.length > 512) {
      return { ok: false, error: "One or more attached images are invalid.", status: 400 }
    }
    const [ownerId, objectName, ...extra] = path.split("/")
    if (ownerId !== userId || !objectName || objectName === "." || objectName === ".." || extra.length > 0) {
      return { ok: false, error: "One or more attached images are invalid.", status: 400 }
    }
    paths.push(path)
  }
  return { ok: true, paths }
}
