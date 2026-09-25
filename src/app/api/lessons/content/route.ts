import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { inngest } from "@/lib/inngest/client"
import { createServerClient } from "@/lib/supabase/server"
import { userOwnsLesson } from "@/lib/lesson-access"
import { needsRealContent } from "@/lib/lesson-content"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"

// POST /api/lessons/content { lessonId, regenerate? }
// Full-lesson generation runs async (output takes 1-3 min, beyond the 60s
// route limit): creates an async_jobs row, fires lesson/generate, returns
// { jobId } for polling. Idempotent: returns stored content immediately when
// real content already exists unless regenerate:true (UI confirms first).
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { lessonId, regenerate } = (await req.json().catch(() => ({}))) as {
    lessonId?: string
    regenerate?: boolean
  }
  if (!lessonId) {
    return NextResponse.json({ error: "Missing lessonId" }, { status: 400 })
  }
  const rl = await checkRateLimit(`rl:${userId}:lesson`, RATE_LIMITS.lesson.limit, RATE_LIMITS.lesson.windowMs)
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many lesson requests. Please wait a bit and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  const supabase = createServerClient()
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id,content_md,example_code")
    .eq("id", lessonId)
    .single()
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
  }

  // Ownership check — never leak or generate for another user's content
  if (!(await userOwnsLesson(supabase, userId, lessonId))) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
  }

  const existing = (lesson.content_md ?? "") as string
  if (!regenerate && !needsRealContent(existing)) {
    return NextResponse.json({
      contentMd: existing,
      exampleCode: (lesson.example_code ?? "") as string,
      cached: true,
    })
  }

  const jobId = crypto.randomUUID()
  const { error: jobError } = await supabase.from("async_jobs").upsert({
    id: jobId,
    status: "processing",
    started_at: new Date().toISOString(),
  }, { onConflict: "id" })
  if (jobError) {
    console.error("[lessons/content] Failed to create async_jobs record:", jobError.message)
    return NextResponse.json({ error: "We couldn't start generation (database unavailable). Please try again in a minute." }, { status: 503 })
  }

  try {
    await inngest.send({
      name: "lesson/generate",
      data: { jobId, lessonId, userId },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[lessons/content] Inngest send failed:", message)
    await supabase.from("async_jobs").upsert({
      id: jobId,
      status: "failed",
      error: `Lesson trigger failed: ${message}`,
      completed_at: new Date().toISOString(),
    }, { onConflict: "id" })
    return NextResponse.json({ error: "Failed to start generation", jobId }, { status: 500 })
  }

  return NextResponse.json({ jobId, status: "processing" }, { status: 202 })
}
