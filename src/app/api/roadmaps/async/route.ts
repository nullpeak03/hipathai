import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { inngest } from "@/lib/inngest/client"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  console.log("[async] POST request received")
  // Never trust the client-provided userId — derive it from the session so
  // roadmaps are always owned by the caller.
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const goal = body.goal || "AI Agent Developer"
  const jobId = crypto.randomUUID()

  console.log("[async] Creating job record:", jobId)
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
    console.log("[async] Sending Inngest event for job:", jobId)
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
        userId
      }
    })
    console.log("[async] Inngest event sent for job:", jobId)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[async] Inngest send failed:", message)
    // Mark job as failed so status endpoint shows error
    await supabase.from("async_jobs").upsert({
      id: jobId,
      status: "failed",
      error: `Inngest trigger failed: ${message}`,
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