import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"

// GET /api/chat/threads — caller's threads, newest first.
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const supabase = createServerClient()
  const { data } = await supabase
    .from("chat_threads")
    .select("id,title,roadmap_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30)
  return NextResponse.json({ threads: data ?? [] })
}

// POST /api/chat/threads { roadmapId? } — start a thread (roadmap link optional).
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { roadmapId } = (await req.json().catch(() => ({}))) as { roadmapId?: string }
  const supabase = createServerClient()
  if (roadmapId) {
    const { data: roadmap } = await supabase
      .from("roadmaps")
      .select("user_id")
      .eq("id", roadmapId)
      .single()
    if (!roadmap || (roadmap as { user_id: string }).user_id !== userId) {
      return NextResponse.json({ error: "Roadmap not found" }, { status: 404 })
    }
  }
  const { data, error } = await supabase
    .from("chat_threads")
    .insert({ user_id: userId, roadmap_id: roadmapId ?? null, title: "New conversation" })
    .select("id,title,roadmap_id,created_at")
    .single()
  if (error || !data) {
    return NextResponse.json({ error: "Failed to create thread" }, { status: 500 })
  }
  return NextResponse.json({ thread: data })
}
