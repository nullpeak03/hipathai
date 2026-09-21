import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { toRoadmapData, type RoadmapRow, type PhaseRow, type LessonRow } from "@/lib/roadmap-shape"

const NOT_FOUND_CODE = "PGRST116"

type ServerClient = ReturnType<typeof createServerClient>

/** Full roadmap tree for an owned roadmap id, or null (missing/unowned). */
async function loadFullRoadmap(supabase: ServerClient, jobId: string, userId: string | null) {
  const { data: roadmap, error } = await supabase
    .from("roadmaps")
    .select("id, user_id, title, description, goal, lessons_total, created_at")
    .eq("id", jobId)
    .single()
  if (error?.code === NOT_FOUND_CODE || !roadmap) return null
  // Ownership check — never leak another user's roadmap
  if ((roadmap.user_id as string | null) !== userId) return null
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
  return toRoadmapData(roadmap as unknown as RoadmapRow, phaseRows, lessonRows)
}

/** Live build progress: saved phases now, planned total from the job result. */
async function loadProgress(supabase: ServerClient, jobId: string) {
  const { count } = await supabase
    .from("phases")
    .select("id", { count: "exact", head: true })
    .eq("roadmap_id", jobId)
  const { data: job } = await supabase
    .from("async_jobs")
    .select("result")
    .eq("id", jobId)
    .single()
  const total = Number(
    ((job as { result?: { totalPhases?: unknown } } | null)?.result?.totalPhases) ?? 0
  ) || 0
  return { progress: { phasesDone: count ?? 0, totalPhases: total } }
}

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

    // 1. Job row first: it is the source of truth for lifecycle state.
    // (The roadmap row is created early now, so its mere existence no longer
    // means the job finished.)
    const { data: job, error: jobError } = await supabase
      .from("async_jobs")
      .select("status, error, result, started_at, completed_at")
      .eq("id", jobId)
      .single()

    const jobNotFound = jobError?.code === NOT_FOUND_CODE || !job
    console.log("[status] async_jobs query:", { jobId, found: !!job, status: job?.status, error: jobError?.message, code: jobError?.code })

    if (!jobNotFound && job) {
      if (job.status === "failed") {
        return NextResponse.json({ jobId, status: "failed", error: job.error })
      }
      if (job.status === "completed") {
        const full = await loadFullRoadmap(supabase, jobId, userId)
        if (!full) {
          return NextResponse.json({ jobId, status: "not_found" }, { status: 404 })
        }
        return NextResponse.json({ jobId, status: "completed", roadmap: full })
      }
      // Processing: stale guard — a job stuck this long will never finish
      // (e.g. its worker request was killed). Fail it loudly instead of
      // letting clients poll forever.
      if (job.started_at && Date.now() - new Date(job.started_at).getTime() > 30 * 60 * 1000) {
        const staleError = "Generation timed out on our side. Please try again."
        await supabase.from("async_jobs").upsert({
          id: jobId,
          status: "failed",
          error: staleError,
          completed_at: new Date().toISOString()
        }, { onConflict: "id" })
        console.log("[status] Marked stale job failed:", jobId)
        return NextResponse.json({ jobId, status: "failed", error: staleError })
      }
      // Live progress: count saved phases so the UI can show real progress.
      const progress = await loadProgress(supabase, jobId)
      return NextResponse.json({ jobId, status: "processing", started_at: job.started_at, ...progress })
    }

    // 2. Legacy fallback: roadmap row without a job row (shouldn't happen
    // for new jobs, but older rows may exist).
    const full = await loadFullRoadmap(supabase, jobId, userId)
    if (full) {
      return NextResponse.json({ jobId, status: "completed", roadmap: full })
    }
    return NextResponse.json({ jobId, status: "not_found" }, { status: 404 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[status] Error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}