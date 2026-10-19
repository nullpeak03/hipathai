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
  const { data, error } = await supabase.from("replan_proposals").select("*").eq("roadmap_id", roadmapId).order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: "Failed to load proposals" }, { status: 500 })
  return NextResponse.json({ proposals: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { roadmapId?: string; reason?: string; proposedChanges?: Record<string, unknown> }
  if (!body.roadmapId || !body.reason) return NextResponse.json({ error: "Missing roadmapId/reason" }, { status: 400 })
  const supabase = createServerClient()
  const { data: roadmap } = await supabase.from("roadmaps").select("id").eq("id", body.roadmapId).eq("user_id", userId).single()
  if (!roadmap) return NextResponse.json({ error: "Roadmap not found" }, { status: 404 })
  const { data, error } = await supabase.from("replan_proposals").insert({
    roadmap_id: body.roadmapId,
    user_id: userId,
    reason: body.reason,
    proposed_changes: body.proposedChanges ?? {},
    status: "pending",
  }).select().single()
  if (error) return NextResponse.json({ error: "Failed to create proposal" }, { status: 500 })
  return NextResponse.json({ ok: true, proposal: data })
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { proposalId?: string; status?: "approved" | "rejected" | "applied" }
  if (!body.proposalId || !body.status) return NextResponse.json({ error: "Missing proposalId/status" }, { status: 400 })
  const supabase = createServerClient()
  const { data: proposal } = await supabase.from("replan_proposals").select("id,user_id").eq("id", body.proposalId).single()
  if (!proposal || proposal.user_id !== userId) return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
  const { error } = await supabase.from("replan_proposals").update({ status: body.status, decided_at: new Date().toISOString() }).eq("id", body.proposalId)
  if (error) return NextResponse.json({ error: "Failed to update proposal" }, { status: 500 })
  return NextResponse.json({ ok: true })
}
