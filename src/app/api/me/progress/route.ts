import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { userOwnsLesson } from "@/lib/lesson-access"

// POST /api/me/progress { lessonId, passed, score } — upsert caller's
// completion row. Lesson ownership is verified before writing.
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = (await req.json().catch(() => ({}))) as {
    lessonId?: string
    passed?: boolean
    score?: number
  }
  if (!body.lessonId || typeof body.passed !== "boolean") {
    return NextResponse.json({ error: "Missing lessonId/passed" }, { status: 400 })
  }
  const score = typeof body.score === "number" && Number.isFinite(body.score)
    ? Math.max(0, Math.min(100, Math.round(body.score)))
    : 0

  const supabase = createServerClient()
  if (!(await userOwnsLesson(supabase, userId, body.lessonId))) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
  }
  const { error } = await supabase.from("progress").upsert(
    { user_id: userId, lesson_id: body.lessonId, completed: true, passed: body.passed, score },
    { onConflict: "user_id,lesson_id" }
  )
  if (error) {
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
