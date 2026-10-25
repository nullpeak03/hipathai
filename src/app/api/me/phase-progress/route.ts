import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"

// GET /api/me/phase-progress — map phaseId → {passed, score, attempts}
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const supabase = createServerClient()
  const { data } = await supabase.from("phase_exam_progress").select("phase_id,passed,score,attempts").eq("user_id", userId)
  const rows = (data ?? []) as { phase_id: string; passed: boolean; score: number | null; attempts: number }[]
  const map: Record<string, { passed: boolean; score: number | null; attempts: number }> = {}
  for (const r of rows) map[r.phase_id] = { passed: r.passed, score: r.score, attempts: r.attempts }
  return NextResponse.json({ progress: map })
}

// POST /api/me/phase-progress { phaseId, passed, score } — upsert exam result
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ error: "Submit a server-issued phase assessment instead." }, { status: 410 })
}
