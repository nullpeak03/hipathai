import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/client"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 })
  }

  try {
    const supabase = createClient()

    // 1. Check if roadmap completed (exists in roadmaps table)
    const { data: roadmap, error: roadmapError } = await supabase
      .from("roadmaps")
      .select("id, title, description, goal, lessons_total, created_at")
      .eq("id", jobId)
      .single()

    if (!roadmapError && roadmap) {
      return NextResponse.json({
        jobId,
        status: "completed",
        roadmap: {
          id: roadmap.id,
          title: roadmap.title,
          description: roadmap.description,
          goal: roadmap.goal,
          totalLessons: roadmap.lessons_total
        }
      })
    }

    // 2. Check async_jobs for processing/failed state
    const { data: job, error: jobError } = await supabase
      .from("async_jobs")
      .select("status, error, result, started_at, completed_at")
      .eq("id", jobId)
      .single()

    if (jobError || !job) {
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}