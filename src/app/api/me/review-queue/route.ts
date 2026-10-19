import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { maybePublishRoadmap } from "@/lib/public-publish"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("roadmap_review_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: "Failed to load review queue" }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { id?: string; status?: "approved" | "rejected" }
  if (!body.id || !body.status) return NextResponse.json({ error: "Missing id/status" }, { status: 400 })
  const supabase = createServerClient()
  const { data: item } = await supabase.from("roadmap_review_queue").select("*").eq("id", body.id).single()
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (body.status === "approved") {
    await maybePublishRoadmap((item as { roadmap_id: string }).roadmap_id)
    await supabase.from("roadmap_review_queue").update({ status: "published", reviewer_id: userId, reviewed_at: new Date().toISOString() }).eq("id", body.id)
  } else {
    await supabase.from("roadmap_review_queue").update({ status: "rejected", reviewer_id: userId, reviewed_at: new Date().toISOString() }).eq("id", body.id)
  }
  return NextResponse.json({ ok: true })
}
