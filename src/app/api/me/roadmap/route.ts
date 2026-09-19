import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { toRoadmapData, type RoadmapRow, type PhaseRow, type LessonRow } from "@/lib/roadmap-shape"

// GET /api/me/roadmap — latest full roadmap for the caller (source of truth;
// the client caches the result in localStorage for fast paint + offline).
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const supabase = createServerClient()
  const { data: roadmap } = await supabase
    .from("roadmaps")
    .select("id,title,description,lessons_total")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()
  if (!roadmap) {
    return NextResponse.json({ roadmap: null })
  }
  const row = roadmap as unknown as RoadmapRow
  const { data: phases } = await supabase
    .from("phases")
    .select("id,idx,title")
    .eq("roadmap_id", row.id)
    .order("idx")
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id,phase_id,idx,title,content_md,example_code,quiz")
    .eq("roadmap_id", row.id)
    .order("idx")
  const full = toRoadmapData(row, (phases ?? []) as PhaseRow[], (lessons ?? []) as LessonRow[])
  return NextResponse.json({ roadmap: full })
}
