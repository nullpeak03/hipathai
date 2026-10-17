import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { getErrorMessage } from "@/lib/utils"

const MAX_UPLOAD_MB = 5
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]

/**
 * POST /api/upload/image
 * Generates a signed upload URL for Supabase Storage.
 * Client PUTs the file directly to Supabase (bypassing Next.js body limits).
 * Returns { uploadUrl, path, publicUrl }.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rl = await checkRateLimit(
    `rl:${userId}:upload`,
    RATE_LIMITS.code.limit,
    RATE_LIMITS.code.windowMs
  )
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many uploads. Please wait a bit and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  const body = (await req.json().catch(() => ({}))) as {
    fileName?: string
    contentType?: string
  }
  const fileName = body.fileName || "upload"
  const contentType = body.contentType || "image/png"

  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json({ error: "Unsupported file type." }, { status: 400 })
  }

  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  const path = `${userId}/${Date.now()}-${safeFileName}`

  const supabase = createServerClient()
  const { data, error } = await supabase.storage
    .from("tutor-images")
    .createSignedUploadUrl(path, { upsert: false })

  if (error || !data) {
    console.error("[upload/image] signed url error:", getErrorMessage(error))
    return NextResponse.json({ error: "Could not create upload URL." }, { status: 500 })
  }

  const { signedUrl, path: storedPath } = data as { signedUrl: string; path: string }
  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tutor-images/${storedPath}`

  return NextResponse.json({
    uploadUrl: signedUrl,
    path: storedPath,
    publicUrl,
    maxBytes: MAX_UPLOAD_BYTES,
    contentType,
  })
}
