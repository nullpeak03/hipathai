import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"

// GET /api/chat/threads/[threadId] — full message history (owner only).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const supabase = createServerClient()
  const { data: thread } = await supabase
    .from("chat_threads")
    .select("user_id")
    .eq("id", threadId)
    .single()
  if (!thread || (thread as { user_id: string }).user_id !== userId) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 })
  }
  const { data: messages } = await supabase
    .from("chat_messages")
    .select("role,content,meta,created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
  const enriched = ((messages ?? []) as { role: string; content: string; meta: unknown; created_at: string }[]).map((m) => ({
    role: m.role,
    content: m.content,
    blocks: (m.meta as { blocks?: unknown } | null)?.blocks ?? null,
    created_at: m.created_at,
  }))
  return NextResponse.json({ messages: enriched })
}

// DELETE /api/chat/threads/[threadId] — delete own thread (messages cascade).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const supabase = createServerClient()
  const { data: thread } = await supabase
    .from("chat_threads")
    .select("user_id")
    .eq("id", threadId)
    .single()
  if (!thread || (thread as { user_id: string }).user_id !== userId) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 })
  }
  const { error } = await supabase.from("chat_threads").delete().eq("id", threadId)
  if (error) {
    return NextResponse.json({ error: "Failed to delete thread" }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
