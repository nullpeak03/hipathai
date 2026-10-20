import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { maybePublishRoadmap, normalizeTopic, topicsMatch } from "@/lib/public-publish"
import { isUnlimitedUser } from "@/lib/unlimited"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isUnlimitedUser(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const supabase = createServerClient()
  const { data: items, error } = await supabase
    .from("roadmap_review_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: "Failed to load review queue" }, { status: 500 })

  const enriched = await Promise.all((items ?? []).map(async (item: any) => {
    const { data: roadmap } = await supabase
      .from("roadmaps")
      .select("id,title,description,goal,level,lessons_total")
      .eq("id", item.roadmap_id)
      .single()
    const { data: user } = await supabase
      .from("users")
      .select("clerk_id,email,name")
      .eq("clerk_id", item.user_id)
      .single()
    const { data: phases } = await supabase
      .from("phases")
      .select("id,idx,title")
      .eq("roadmap_id", item.roadmap_id)
      .order("idx")
    const phaseRows = phases ?? []
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id,phase_id,title")
      .eq("roadmap_id", item.roadmap_id)
    const lessonCount = (lessons ?? []).length
    const { data: existing } = await supabase.from("public_roadmaps").select("id,slug,title,goal").limit(500)
    const similar = ((existing ?? []) as { id: string; slug: string; title: string; goal: string }[])
      .filter((r) => topicsMatch(r.goal, roadmap?.goal ?? ""))
      .slice(0, 5)
    return {
      ...item,
      roadmap: roadmap ?? null,
      user: user ?? null,
      phaseCount: phaseRows.length,
      lessonCount,
      phases: phaseRows,
      similar,
    }
  }))

  return NextResponse.json({ items: enriched })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { roadmapId?: string; reason?: string }
  if (!body.roadmapId) return NextResponse.json({ error: "Missing roadmapId" }, { status: 400 })
  const supabase = createServerClient()
  const { data: roadmap } = await supabase.from("roadmaps").select("id").eq("id", body.roadmapId).eq("user_id", userId).single()
  if (!roadmap) return NextResponse.json({ error: "Roadmap not found" }, { status: 404 })
  const { data, error } = await supabase.from("roadmap_review_queue").insert({
    roadmap_id: body.roadmapId,
    user_id: userId,
    status: "pending",
    reason: body.reason || "User requested publish",
  }).select().single()
  if (error) return NextResponse.json({ error: "Failed to submit" }, { status: 500 })
  return NextResponse.json({ ok: true, item: data })
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isUnlimitedUser(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = (await req.json().catch(() => ({}))) as { id?: string; status?: "approved" | "rejected"; reason?: string }
  if (!body.id || !body.status) return NextResponse.json({ error: "Missing id/status" }, { status: 400 })
  if (body.status === "rejected" && !body.reason?.trim()) return NextResponse.json({ error: "Rejection reason required" }, { status: 400 })
  const supabase = createServerClient()
  const { data: item } = await supabase.from("roadmap_review_queue").select("*").eq("id", body.id).single()
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (body.status === "approved") {
    await maybePublishRoadmap((item as { roadmap_id: string }).roadmap_id)
    await supabase.from("roadmap_review_queue").update({ status: "published", reviewer_id: userId, reviewed_at: new Date().toISOString() }).eq("id", body.id)
  } else {
    await supabase.from("roadmap_review_queue").update({ status: "rejected", reason: body.reason, reviewer_id: userId, reviewed_at: new Date().toISOString() }).eq("id", body.id)
  }
  return NextResponse.json({ ok: true })
}
