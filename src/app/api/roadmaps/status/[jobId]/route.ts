import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { toRoadmapData, type RoadmapRow, type PhaseRow, type LessonRow } from "@/lib/roadmap-shape"

const NOT_FOUND_CODE = "PGRST116"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 })
  }

  try {
    const { userId } = await auth()
    const supabase = createServerClient()
    console.log("[status] Checking job:", jobId)

    // 1. Check if roadmap completed (exists in roadmaps table)
    const { data: roadmap, error: roadmapError } = await supabase
      .from("roadmaps")
      .select("id, user_id, title, description, goal, lessons_total, created_at")
      .eq("id", jobId)
      .single()

    const roadmapNotFound = roadmapError?.code === NOT_FOUND_CODE || !roadmap
    console.log("[status] Roadmap query:", { jobId, found: !!roadmap, error: roadmapError?.message, code: roadmapError?.code })

    if (!roadmapNotFound && roadmap) {
      // Ownership check — never leak another user's roadmap (return 404 as if missing)
      if ((roadmap.user_id as string | null) !== userId) {
        return NextResponse.json({ jobId, status: "not_found" }, { status: 404 })
      }
      // Return the FULL roadmap (phases + lessons with real UUIDs) so the
      // client caches Supabase as the source of truth — no synthetic IDs.
      const { data: phases } = await supabase
        .from("phases")
        .select("id,idx,title")
        .eq("roadmap_id", jobId)
        .order("idx")
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id,phase_id,idx,title,content_md,example_code,quiz")
        .eq("roadmap_id", jobId)
        .order("idx")
      const phaseRows = (phases ?? []) as PhaseRow[]
      const lessonRows = (lessons ?? []) as LessonRow[]
      const full = toRoadmapData(roadmap as unknown as RoadmapRow, phaseRows, lessonRows)
      return NextResponse.json({ jobId, status: "completed", roadmap: full })
    }

    // 2. Check async_jobs for processing/failed state
    const { data: job, error: jobError } = await supabase
      .from("async_jobs")
      .select("status, error, result, started_at, completed_at")
      .eq("id", jobId)
      .single()

    const jobNotFound = jobError?.code === NOT_FOUND_CODE || !job
    console.log("[status] async_jobs query:", { jobId, found: !!job, status: job?.status, error: jobError?.message, code: jobError?.code })

    if (jobNotFound) {
      return NextResponse.json({ jobId, status: "not_found" }, { status: 404 })
    }

    // 3. Return job status (processing, completed, failed)
    return NextResponse.json({
      jobId,
      status: job.status,
      error: job.error,
      result: job.result,
      started_at: job.started_at,
      completed_at: job.completed_at
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[status] Error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}