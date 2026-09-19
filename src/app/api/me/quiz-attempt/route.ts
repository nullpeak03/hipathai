import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { userOwnsLesson } from "@/lib/lesson-access"
import { scheduleAfterFail, scheduleAfterPass } from "@/lib/review"

// POST /api/me/quiz-attempt { lessonId, answers, score, passed, topic? }
// Logs every attempt. On failure the topic's fail_count is bumped so
// weakness detection + dashboard chips stay in sync with one call.
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = (await req.json().catch(() => ({}))) as {
    lessonId?: string
    answers?: Record<number, number>
    score?: number
    passed?: boolean
    topic?: string
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

  const { error } = await supabase.from("quiz_attempts").insert({
    user_id: userId,
    lesson_id: body.lessonId,
    answers: body.answers ?? {},
    score,
    passed: body.passed,
  })
  if (error) {
    return NextResponse.json({ error: "Failed to log attempt" }, { status: 500 })
  }

  if (!body.passed && body.topic) {
    const { data: existing } = await supabase
      .from("weak_topics")
      .select("fail_count")
      .eq("user_id", userId)
      .eq("topic", body.topic)
      .single()
    const count = (((existing as { fail_count: number | null } | null)?.fail_count) ?? 0) + 1
    await supabase
      .from("weak_topics")
      .upsert({ user_id: userId, topic: body.topic, fail_count: count }, { onConflict: "user_id,topic" })
  }

  // Spaced repetition: failure (re)schedules a review for tomorrow and resets
  // the streak; each consecutive pass advances through expanding intervals.
  const todayStr = new Date().toISOString().slice(0, 10)
  if (!body.passed) {
    if (body.topic) {
      const next = scheduleAfterFail(todayStr, score)
      await supabase.from("review_schedule").upsert(
        {
          user_id: userId, lesson_id: body.lessonId, topic: body.topic,
          interval_days: next.intervalDays, repetitions: next.repetitions,
          next_review_at: next.nextReviewAt, last_score: next.lastScore,
        },
        { onConflict: "user_id,lesson_id" }
      )
    }
  } else {
    const { data: sched } = await supabase
      .from("review_schedule")
      .select("topic,repetitions")
      .eq("user_id", userId)
      .eq("lesson_id", body.lessonId)
      .single()
    const prev = sched as { topic: string; repetitions: number | null } | null
    if (prev) {
      const next = scheduleAfterPass(todayStr, score, prev.repetitions ?? 0)
      await supabase.from("review_schedule").upsert(
        {
          user_id: userId, lesson_id: body.lessonId, topic: prev.topic,
          interval_days: next.intervalDays, repetitions: next.repetitions,
          next_review_at: next.nextReviewAt, last_score: next.lastScore,
        },
        { onConflict: "user_id,lesson_id" }
      )
    }
  }

  return NextResponse.json({ ok: true })
}
