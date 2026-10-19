import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roadmapId = req.nextUrl.searchParams.get("roadmapId")
  if (!roadmapId) return NextResponse.json({ error: "Missing roadmapId" }, { status: 400 })
  const supabase = createServerClient()
  const { data: roadmap } = await supabase.from("roadmaps").select("id").eq("id", roadmapId).eq("user_id", userId).single()
  if (!roadmap) return NextResponse.json({ error: "Roadmap not found" }, { status: 404 })
  const { data, error } = await supabase.from("skill_nodes").select("*").eq("roadmap_id", roadmapId)
  if (error) return NextResponse.json({ error: "Failed to load skill graph" }, { status: 500 })
  return NextResponse.json({ nodes: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as {
    roadmapId?: string
    nodes?: { lessonId?: string; topic: string; difficulty?: string; prerequisites?: string[] }[]
  }
  if (!body.roadmapId || !Array.isArray(body.nodes)) {
    return NextResponse.json({ error: "Missing roadmapId/nodes" }, { status: 400 })
  }
  const supabase = createServerClient()
  const { data: roadmap } = await supabase.from("roadmaps").select("id").eq("id", body.roadmapId).eq("user_id", userId).single()
  if (!roadmap) return NextResponse.json({ error: "Roadmap not found" }, { status: 404 })
  const rows = body.nodes.map((n) => ({
    roadmap_id: body.roadmapId,
    lesson_id: n.lessonId ?? null,
    topic: n.topic,
    difficulty: n.difficulty ?? null,
    prerequisites: n.prerequisites ?? [],
  }))
  const { error } = await supabase.from("skill_nodes").upsert(rows, { onConflict: "roadmap_id,topic" })
  if (error) return NextResponse.json({ error: "Failed to save skill graph" }, { status: 500 })
  return NextResponse.json({ ok: true, count: rows.length })
}
