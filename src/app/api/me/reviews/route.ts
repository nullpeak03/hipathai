import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"

// GET /api/me/reviews — lessons due for spaced-repetition review
// (next_review_at <= today), most overdue first, with titles + deep links.
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const supabase = createServerClient()
  const todayStr = new Date().toISOString().slice(0, 10)
  const { data: rows } = await supabase
    .from("review_schedule")
    .select("lesson_id,topic,repetitions,last_score,next_review_at")
    .eq("user_id", userId)
    .lte("next_review_at", todayStr)
    .order("next_review_at", { ascending: true })
    .limit(20)

  const sched = ((rows ?? []) as {
    lesson_id: string
    topic: string
    repetitions: number | null
    last_score: number | null
    next_review_at: string
  }[])
  if (sched.length === 0) {
    return NextResponse.json({ reviews: [] })
  }

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id,title,roadmap_id")
    .in("id", sched.map((s) => s.lesson_id))
  const byId = new Map(
    (((lessons ?? []) as { id: string; title: string; roadmap_id: string }[])).map((l) => [l.id, l])
  )
  const todayMs = Date.parse(`${todayStr}T00:00:00Z`)
  const reviews = sched
    .map((s) => {
      const lesson = byId.get(s.lesson_id)
      if (!lesson) return null
      const overdueDays = Math.max(
        0,
        Math.round((todayMs - Date.parse(`${s.next_review_at}T00:00:00Z`)) / 86400000)
      )
      return {
        lessonId: s.lesson_id,
        roadmapId: lesson.roadmap_id,
        title: lesson.title,
        topic: s.topic,
        repetitions: s.repetitions ?? 0,
        lastScore: s.last_score,
        nextReviewAt: s.next_review_at,
        overdueDays,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
  return NextResponse.json({ reviews })
}
