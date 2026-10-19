import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { userOwnsLesson } from "@/lib/lesson-access"
import { masteryFromQuiz } from "@/lib/v2-mastery"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("learner_mastery")
    .select("id,user_id,roadmap_id,lesson_id,topic,mastery_score,attempts,last_practiced_at,decay_rate,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
  if (error) return NextResponse.json({ error: "Failed to load mastery" }, { status: 500 })
  return NextResponse.json({ mastery: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as {
    lessonId?: string
    roadmapId?: string
    topic?: string
    score?: number
    attempts?: number
  }
  if (!body.topic || typeof body.score !== "number") {
    return NextResponse.json({ error: "Missing topic/score" }, { status: 400 })
  }
  const supabase = createServerClient()
  if (body.lessonId && !(await userOwnsLesson(supabase, userId, body.lessonId))) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
  }
  const score = Math.max(0, Math.min(100, Math.round(body.score)))
  const attempts = typeof body.attempts === "number" && body.attempts > 0 ? Math.round(body.attempts) : 1
  const masteryScore = masteryFromQuiz(score, attempts)
  const { error } = await supabase.from("learner_mastery").upsert(
    {
      user_id: userId,
      roadmap_id: body.roadmapId ?? null,
      lesson_id: body.lessonId ?? null,
      topic: body.topic,
      mastery_score: masteryScore,
      attempts,
      last_practiced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,roadmap_id,topic" }
  )
  if (error) return NextResponse.json({ error: "Failed to save mastery" }, { status: 500 })
  return NextResponse.json({ ok: true, masteryScore })
}
