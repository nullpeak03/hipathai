import { NextRequest, NextResponse } from "next/server"
import { inngest } from "@/lib/inngest/client"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const goal = body.goal || "AI Agent Developer"
  const jobId = crypto.randomUUID()

  // Create async_jobs record FIRST so status endpoint immediately shows "processing"
  const supabase = createServerClient()
  const { error: jobError } = await supabase.from("async_jobs").upsert({
    id: jobId,
    status: "processing",
    started_at: new Date().toISOString()
  }, { onConflict: "id" })

  if (jobError) {
    console.error("[async] Failed to create async_jobs record:", jobError.message)
    // Don't block Inngest trigger - still send event
  } else {
    console.log("[async] Created job record:", jobId)
  }

  // Trigger Inngest async generation
  try {
    await inngest.send({
      name: "roadmap/generate",
      data: {
        jobId,
        goal,
        level: body.level || "Beginner",
        time: body.time || "1hr/day",
        duration: body.duration || "8 weeks",
        why: body.why || "To build career",
        style: body.style || "structured",
        timeMins: parseTimeToMinutes(body.time || "1hr/day"),
        durationDays: parseDurationToDays(body.duration || "8 weeks"),
        userId: body.userId || null
      }
    })
    console.log("[async] Inngest event sent for job:", jobId)
  } catch (e: any) {
    console.error("[async] Inngest send failed:", e.message)
    // Mark job as failed so status endpoint shows error
    await supabase.from("async_jobs").upsert({
      id: jobId,
      status: "failed",
      error: `Inngest trigger failed: ${e.message}`,
      completed_at: new Date().toISOString()
    }, { onConflict: "id" })
    return NextResponse.json({ error: "Failed to start generation", jobId }, { status: 500 })
  }

  return NextResponse.json({ jobId, status: "processing" }, { status: 202 })
}

function parseTimeToMinutes(time: string): number {
  const t = time.toLowerCase().trim()
  if (t.includes("hr") || t.includes("hour")) {
    const match = t.match(/(\d+(?:\.\d+)?)\s*(hr|hour)/)
    if (match) return Math.round(parseFloat(match[1]) * 60)
  }
  if (t.includes("min")) {
    const match = t.match(/(\d+)\s*min/)
    if (match) return parseInt(match[1])
  }
  return 60
}

function parseDurationToDays(duration: string): number {
  const d = duration.toLowerCase().trim()
  if (d.includes("week")) {
    const match = d.match(/(\d+)\s*week/)
    if (match) return parseInt(match[1]) * 7
  }
  if (d.includes("month")) {
    const match = d.match(/(\d+)\s*month/)
    if (match) return parseInt(match[1]) * 30
  }
  if (d.includes("day")) {
    const match = d.match(/(\d+)\s*day/)
    if (match) return parseInt(match[1])
  }
  return 56
}