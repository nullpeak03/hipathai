import { NextRequest, NextResponse } from "next/server"
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
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { phaseId, passed, score } = (await req.json().catch(() => ({}))) as { phaseId?: string; passed?: boolean; score?: number }
  if (!phaseId || typeof passed !== "boolean") return NextResponse.json({ error: "Missing phaseId/passed" }, { status: 400 })
  const supabase = createServerClient()
  // Ownership check via phases → roadmaps
  const { data: phase } = await supabase.from("phases").select("roadmap_id").eq("id", phaseId).single()
  if (!phase) return NextResponse.json({ error: "Phase not found" }, { status: 404 })
  const { data: roadmap } = await supabase.from("roadmaps").select("user_id").eq("id", (phase as { roadmap_id: string }).roadmap_id).single()
  if (!roadmap || (roadmap as { user_id: string }).user_id !== userId) return NextResponse.json({ error: "Phase not found" }, { status: 404 })

  // Fetch existing to increment attempts
  const { data: existing } = await supabase.from("phase_exam_progress").select("attempts").eq("user_id", userId).eq("phase_id", phaseId).single()
  const attempts = ((existing as { attempts: number } | null)?.attempts ?? 0) + 1
  const { error } = await supabase.from("phase_exam_progress").upsert(
    { user_id: userId, phase_id: phaseId, passed, score: typeof score === "number" ? Math.round(score) : null, attempts },
    { onConflict: "user_id,phase_id" }
  )
  if (error) return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  return NextResponse.json({ ok: true, passed, attempts })
}
