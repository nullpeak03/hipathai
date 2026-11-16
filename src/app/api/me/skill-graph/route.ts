import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { normalizeSkillNodes, type SkillNodeInput } from "@/lib/skill-graph-payload"

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roadmapId = req.nextUrl.searchParams.get("roadmapId")
  if (!roadmapId) return NextResponse.json({ error: "Missing roadmapId" }, { status: 400 })
  const supabase = createServerClient()
  const { data: roadmap } = await supabase.from("roadmaps").select("id").eq("id", roadmapId).eq("user_id", userId).single()
  if (!roadmap) return NextResponse.json({ error: "Roadmap not found" }, { status: 404 })
  const { data, error } = await supabase.from("skill_nodes").select("*").eq("roadmap_id", roadmapId)
  if (error) {
    console.error("[skill-graph] load failed", error)
    return NextResponse.json({ error: "Failed to load skill graph" }, { status: 500 })
  }
  return NextResponse.json({ nodes: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as {
    roadmapId?: string
    nodes?: SkillNodeInput[]
  }
  if (!body.roadmapId || !Array.isArray(body.nodes)) {
    return NextResponse.json({ error: "Missing roadmapId/nodes" }, { status: 400 })
  }
  const supabase = createServerClient()
  const { data: roadmap } = await supabase.from("roadmaps").select("id").eq("id", body.roadmapId).eq("user_id", userId).single()
  if (!roadmap) return NextResponse.json({ error: "Roadmap not found" }, { status: 404 })

  // Only links to this roadmap's own lessons may be written.
  const { data: lessons } = await supabase.from("lessons").select("id").eq("roadmap_id", body.roadmapId)
  const allowedLessonIds = new Set((lessons ?? []).map((lesson: { id: string }) => lesson.id))

  const rows = normalizeSkillNodes(body.roadmapId, body.nodes, allowedLessonIds)
  if (rows.length === 0) return NextResponse.json({ ok: true, count: 0 })

  const { error } = await supabase.from("skill_nodes").upsert(rows, { onConflict: "roadmap_id,topic" })
  if (error) {
    console.error("[skill-graph] upsert failed", error)
    return NextResponse.json({ error: "Failed to save skill graph" }, { status: 500 })
  }
  return NextResponse.json({ ok: true, count: rows.length })
}
