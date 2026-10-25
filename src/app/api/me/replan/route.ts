import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roadmapId = req.nextUrl.searchParams.get("roadmapId")
  if (!roadmapId) return NextResponse.json({ error: "Missing roadmapId" }, { status: 400 })
  const supabase = createServerClient()
  const { data: roadmap, error: roadmapError } = await supabase.from("roadmaps").select("id").eq("id", roadmapId).eq("user_id", userId).single()
  if (roadmapError || !roadmap) return NextResponse.json({ error: "Roadmap not found" }, { status: 404 })
  const [{ data: proposals, error: proposalsError }, { data: revisions, error: revisionsError }] = await Promise.all([
    supabase.from("replan_proposals").select("*").eq("roadmap_id", roadmapId).eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("roadmap_revisions").select("id,reason,changes,created_at").eq("roadmap_id", roadmapId).eq("user_id", userId).order("created_at", { ascending: false }),
  ])
  if (proposalsError || revisionsError) return NextResponse.json({ error: "Failed to load roadmap adaptation history" }, { status: 500 })
  return NextResponse.json({ proposals: proposals ?? [], revisions: revisions ?? [] })
}
