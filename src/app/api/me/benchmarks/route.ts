import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"

// GET /api/me/benchmarks — aggregate-only community stats (no PII).
// Lets learners compare their own numbers against cohort averages.
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const supabase = createServerClient()
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 6)
  const weekAgoStr = weekAgo.toISOString().slice(0, 10)

  const [{ count: learners }, { data: gams }, { data: acts }] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("gamification").select("xp,level,streak,pass_rate"),
    supabase.from("daily_activity").select("user_id,minutes").gte("activity_date", weekAgoStr),
  ])

  const gamRows = ((gams ?? []) as {
    xp: number | null
    level: number | null
    streak: number | null
    pass_rate: number | null
  }[])
  const avg = (vals: (number | null)[]): number =>
    vals.length === 0 ? 0 : Math.round(vals.reduce<number>((a, v) => a + (v ?? 0), 0) / vals.length)

  const actRows = ((acts ?? []) as { user_id: string; minutes: number | null }[])
  const weeklyTotal = actRows.reduce<number>((a, r) => a + (r.minutes ?? 0), 0)
  const weeklyUsers = new Set(actRows.map((r) => r.user_id)).size

  return NextResponse.json({
    learners: learners ?? 0,
    avgXp: avg(gamRows.map((g) => g.xp)),
    avgLevel: avg(gamRows.map((g) => g.level)),
    avgStreak: avg(gamRows.map((g) => g.streak)),
    avgPassRate: avg(gamRows.map((g) => g.pass_rate)),
    avgWeeklyMinutes: weeklyUsers === 0 ? 0 : Math.round(weeklyTotal / weeklyUsers),
  })
}
