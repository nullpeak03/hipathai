import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"

// DELETE /api/me/roadmaps/[id] — delete a caller-owned roadmap.
// Phases, lessons, progress, attempts, and chat history cascade via FKs;
// user-level rows (gamification, weak topics) are kept.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const supabase = createServerClient()
  const { data: roadmap } = await supabase
    .from("roadmaps")
    .select("user_id")
    .eq("id", id)
    .single()
  if (!roadmap || (roadmap as { user_id: string }).user_id !== userId) {
    return NextResponse.json({ error: "Roadmap not found" }, { status: 404 })
  }
  const { error } = await supabase.from("roadmaps").delete().eq("id", id)
  if (error) {
    return NextResponse.json({ error: "Failed to delete roadmap" }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
