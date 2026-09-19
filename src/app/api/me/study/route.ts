import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"

// POST /api/me/study { minutes, xp, lessons } — accumulate today's activity
// row with real lesson dwell time (client-measured, server-clamped).
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = (await req.json().catch(() => ({}))) as {
    minutes?: number
    xp?: number
    lessons?: number
  }
  const clamp = (v: unknown, max: number): number => {
    if (typeof v !== "number" || !Number.isFinite(v)) return 0
    return Math.max(0, Math.min(max, Math.round(v)))
  }
  const minutes = clamp(body.minutes, 180)
  const xp = clamp(body.xp, 1000)
  const lessons = clamp(body.lessons, 50)
  if (minutes === 0 && xp === 0 && lessons === 0) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const supabase = createServerClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data: existing } = await supabase
    .from("daily_activity")
    .select("minutes,xp_earned,lessons_completed")
    .eq("user_id", userId)
    .eq("activity_date", today)
    .single()
  const prev = (existing ?? { minutes: 0, xp_earned: 0, lessons_completed: 0 }) as {
    minutes: number | null
    xp_earned: number | null
    lessons_completed: number | null
  }
  const { error } = await supabase.from("daily_activity").upsert(
    {
      user_id: userId,
      activity_date: today,
      minutes: (prev.minutes ?? 0) + minutes,
      xp_earned: (prev.xp_earned ?? 0) + xp,
      lessons_completed: (prev.lessons_completed ?? 0) + lessons,
    },
    { onConflict: "user_id,activity_date" }
  )
  if (error) {
    return NextResponse.json({ error: "Failed to log study time" }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
