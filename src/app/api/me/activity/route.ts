import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { toGamification, type GamificationRow } from "@/lib/gamification"
import type { Progress } from "@/lib/store"

// GET /api/me/activity — gamification + per-lesson progress for the caller.
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const supabase = createServerClient()
  const [{ data: gam }, { data: rows }] = await Promise.all([
    supabase.from("gamification").select("*").eq("user_id", userId).single(),
    supabase.from("progress").select("lesson_id,completed,passed,score").eq("user_id", userId),
  ])
  const progress: Progress = {}
  for (const r of ((rows ?? []) as { lesson_id: string; completed: boolean | null; passed: boolean | null; score: number | null }[])) {
    progress[r.lesson_id] = {
      completed: r.completed ?? false,
      passed: r.passed ?? false,
      score: r.score ?? undefined,
    }
  }
  return NextResponse.json({
    gamification: gam ? toGamification(gam as unknown as GamificationRow) : null,
    progress,
  })
}
