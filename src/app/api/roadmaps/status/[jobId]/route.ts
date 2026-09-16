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
    const { data, error } = await supabase
      .from("roadmaps")
      .select("id, title, description, goal, lessons_total, created_at")
      .eq("id", jobId)
      .single()

    if (error || !data) {
      // Check if job is still processing
      const { data: pending } = await supabase
        .from("async_jobs")
        .select("status, error, result")
        .eq("id", jobId)
        .single()

      if (pending) {
        return NextResponse.json({
          jobId,
          status: pending.status,
          error: pending.error,
          result: pending.result
        })
      }

      return NextResponse.json({ jobId, status: "not_found" }, { status: 404 })
    }

    // Job completed, return roadmap
    return NextResponse.json({
      jobId,
      status: "completed",
      roadmap: {
        id: data.id,
        title: data.title,
        description: data.description,
        goal: data.goal,
        totalLessons: data.lessons_total
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}