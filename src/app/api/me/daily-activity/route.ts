import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"

// GET /api/me/daily-activity?days=14 — per-day rows for the caller, oldest
// first. Powers the analytics heatmap and dashboard week-over-week stats.
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const daysParam = new URL(req.url).searchParams.get("days")
  const days = daysParam ? Math.max(1, Math.min(90, parseInt(daysParam, 10) || 14)) : 14
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = since.toISOString().slice(0, 10)

  const supabase = createServerClient()
  const { data } = await supabase
    .from("daily_activity")
    .select("activity_date,minutes,xp_earned,lessons_completed")
    .eq("user_id", userId)
    .gte("activity_date", sinceStr)
    .order("activity_date", { ascending: true })
  const rows = ((data ?? []) as {
    activity_date: string
    minutes: number | null
    xp_earned: number | null
    lessons_completed: number | null
  }[]).map((r) => ({
    date: r.activity_date,
    minutes: r.minutes ?? 0,
    xp: r.xp_earned ?? 0,
    lessons: r.lessons_completed ?? 0,
  }))
  return NextResponse.json({ days: rows })
}
