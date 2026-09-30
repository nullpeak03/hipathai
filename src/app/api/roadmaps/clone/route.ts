import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { getErrorMessage } from "@/lib/utils"
import { countSyllabusLessons, isValidSyllabus } from "@/lib/public-roadmaps"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"

// POST /api/roadmaps/clone { slug } — copy a public library syllabus into
// the caller's account as a fresh roadmap (fresh ids, no progress).
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const rl = await checkRateLimit(`rl:${userId}:roadmap`, RATE_LIMITS.roadmap.limit, RATE_LIMITS.roadmap.windowMs)
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many roadmap requests. Please wait a bit and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }
  const { slug } = (await req.json().catch(() => ({}))) as { slug?: string }
  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 })
  }
  try {
    const supabase = createServerClient()
    const { data: pub } = await supabase
      .from("public_roadmaps")
      .select("id,slug,title,description,goal,level,syllabus")
      .eq("slug", slug)
      .single()
    const row = pub as {
      id: string
      slug: string
      title: string
      description: string
      goal: string
      level: string | null
      syllabus: unknown
    } | null
    if (!row || !isValidSyllabus(row.syllabus)) {
      return NextResponse.json({ error: "Roadmap not found" }, { status: 404 })
    }
    const roadmapId = crypto.randomUUID()
    const { error: rmError } = await supabase.from("roadmaps").insert({
      id: roadmapId,
      user_id: userId,
      title: row.title,
      description: row.description,
      goal: row.goal,
      level: row.level ?? "Beginner",
      time_per_day: "1hr/day",
      duration: "8 weeks",
      why: "Started from the public library",
      style: "structured",
      lessons_total: countSyllabusLessons(row.syllabus),
    })
    if (rmError) throw rmError
    for (let pi = 0; pi < row.syllabus.phases.length; pi++) {
      const phase = row.syllabus.phases[pi]!
      const phaseId = crypto.randomUUID()
      const { error: phError } = await supabase
        .from("phases")
        .insert({ id: phaseId, roadmap_id: roadmapId, idx: pi + 1, title: phase.title })
      if (phError) throw phError
      const lessonRows: {
        id: string; roadmap_id: string; phase_id: string; idx: number; title: string;
        content_md: string; example_code: string;
        quiz: { q: string; options: string[]; correct: number; explanation: string }[];
        estimated_minutes: number; prerequisites: string[];
      }[] = phase.lessons.map((l, li) => ({
        id: crypto.randomUUID(),
        roadmap_id: roadmapId,
        phase_id: phaseId,
        idx: li + 1,
        title: l.title,
        content_md: `## ${l.title}\n\n${l.objective || `Learn ${l.title} with AI guidance.`}`,
        example_code: `// Example for ${l.title}`,
        quiz: [{ q: `What is ${l.title}?`, options: ["Option A", "Option B", "Option C", "Option D"], correct: 0, explanation: "Review the lesson." }],
        estimated_minutes: 10,
        prerequisites: [],
      }))
      for (let i = 1; i < lessonRows.length; i++) {
        lessonRows[i]!.prerequisites = [lessonRows[i - 1]!.id]
      }
      if (lessonRows.length > 0) {
        const { error: lsError } = await supabase.from("lessons").insert(lessonRows)
        if (lsError) throw lsError
      }
    }
    // Best-effort conversion counter (never fail the clone over it).
    try {
      const current = await supabase.from("public_roadmaps").select("clones_count").eq("id", row.id).single()
      const n = ((current.data as { clones_count?: number } | null)?.clones_count ?? 0) + 1
      await supabase.from("public_roadmaps").update({ clones_count: n }).eq("id", row.id)
    } catch {
      // ignore
    }
    return NextResponse.json({ roadmapId }, { status: 201 })
  } catch (e) {
    console.error("[roadmaps/clone] failed:", getErrorMessage(e))
    return NextResponse.json({ error: "Could not start this roadmap. Please try again." }, { status: 500 })
  }
}
