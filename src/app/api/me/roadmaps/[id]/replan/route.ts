import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { inngest } from "@/lib/inngest/client"

// POST /api/me/roadmaps/[id]/replan — append a remedial phase for weak topics
// with fail_count >= 3, then trigger lesson generation for each new lesson.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const supabase = createServerClient()
  const { data: roadmap } = await supabase.from("roadmaps").select("user_id").eq("id", id).single()
  if (!roadmap || (roadmap as { user_id: string }).user_id !== userId) {
    return NextResponse.json({ error: "Roadmap not found" }, { status: 404 })
  }
  const { data: weak } = await supabase
    .from("weak_topics")
    .select("topic")
    .eq("user_id", userId)
    .gte("fail_count", 3)
  const topics = ((weak ?? []) as { topic: string }[]).map((w) => w.topic)
  if (topics.length === 0) {
    return NextResponse.json({ ok: true, added: 0 })
  }
  // next phase index
  const { data: phases } = await supabase.from("phases").select("idx").eq("roadmap_id", id)
  const nextIdx = ((phases ?? []) as { idx: number }[]).reduce((m, p) => Math.max(m, p.idx), 0) + 1
  const { data: phase, error: phaseErr } = await supabase
    .from("phases")
    .insert({ roadmap_id: id, idx: nextIdx, title: "Remedial: weak topics" })
    .select("id")
    .single()
  if (phaseErr || !phase) {
    return NextResponse.json({ error: "Failed to create phase" }, { status: 500 })
  }
  const phaseId = (phase as { id: string }).id
  const lessonIds: string[] = []
  for (const topic of topics) {
    const { data: lesson } = await supabase
      .from("lessons")
      .insert({ roadmap_id: id, phase_id: phaseId, idx: lessonIds.length, title: topic, content_md: null })
      .select("id")
      .single()
    if (lesson) {
      const lid = (lesson as { id: string }).id
      lessonIds.push(lid)
      await inngest.send({ name: "lesson/generate", data: { jobId: crypto.randomUUID(), lessonId: lid, userId } })
    }
  }
  await supabase.from("roadmap_revisions").insert({ roadmap_id: id, user_id: userId, reason: `remedial: ${topics.join(", ")}` })
  return NextResponse.json({ ok: true, added: lessonIds.length, lessonIds })
}
