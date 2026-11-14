import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { buildTutorImagePath, extensionForContentType } from "@/lib/upload-path"
import { getErrorMessage } from "@/lib/utils"

const MAX_UPLOAD_MB = 5
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

/**
 * POST /api/upload/image
 * Generates a signed upload URL for Supabase Storage.
 * Client PUTs the file directly to Supabase (bypassing Next.js body limits).
 * Returns { uploadUrl, path }. The path is exchanged for a short-lived
 * signed read URL by the authenticated chat API.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rl = await checkRateLimit(
    `rl:${userId}:upload`,
    RATE_LIMITS.code.limit,
    RATE_LIMITS.code.windowMs,
    Date.now(),
    true
  )
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many uploads. Please wait a bit and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  const body = (await req.json().catch(() => ({}))) as {
    fileName?: unknown
    contentType?: unknown
    size?: unknown
  }
  const contentType =
    typeof body.contentType === "string" ? body.contentType.trim().toLowerCase() : "image/png"

  // The browser PUTs directly to Storage, so the bucket (migration 027) is the
  // real size gate; this check stops an obviously oversized upload before a
  // signed URL is minted, and gives the client a clear error.
  if (!extensionForContentType(contentType)) {
    return NextResponse.json({ error: "Unsupported file type." }, { status: 400 })
  }
  if (typeof body.size === "number" && body.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `Images must be ${MAX_UPLOAD_MB} MB or smaller.` }, { status: 413 })
  }

  // Extension comes from the content type, never the file name, and the name
  // is bounded so the stored path stays valid for the chat validator.
  const path = buildTutorImagePath({ userId, fileName: body.fileName, contentType })

  const supabase = createServerClient()
  const { data, error } = await supabase.storage
    .from("tutor-images")
    .createSignedUploadUrl(path, { upsert: false })

  if (error || !data) {
    console.error("[upload/image] signed url error:", getErrorMessage(error))
    return NextResponse.json({ error: "Could not create upload URL." }, { status: 500 })
  }

  const { signedUrl, path: storedPath } = data as { signedUrl: string; path: string }

  return NextResponse.json({
    uploadUrl: signedUrl,
    path: storedPath,
    maxBytes: MAX_UPLOAD_BYTES,
    contentType,
  })
}
