import { NextRequest, NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { inngest } from "@/lib/inngest/client"
import { createServerClient } from "@/lib/supabase/server"
import { getErrorMessage } from "@/lib/utils"
import { parseTimeToMinutes, parseDurationToDays } from "@/lib/roadmap-sizing"

/**
 * Self-healing provisioning: the Clerk webhook is the primary path, but if
 * the caller has no users row (missed webhook, redelivery gap), create it
 * here from the authoritative Clerk profile so generation never FK-fails.
 * Insert-only — existing XP/streaks are never touched.
 */
async function ensureUserProvisioned(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<boolean> {
  try {
    const { data: existing } = await supabase
      .from("users")
      .select("clerk_id")
      .eq("clerk_id", userId)
      .single()
    if (existing) return true
    const client = await clerkClient()
    const u = await client.users.getUser(userId)
    const email = u.emailAddresses?.[0]?.emailAddress ?? null
    const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || null
    const { error: userError } = await supabase
      .from("users")
      .upsert({ clerk_id: userId, email, name, avatar_url: u.imageUrl ?? null }, { onConflict: "clerk_id" })
    if (userError) {
      console.error("[async] User provision failed:", userError.message)
      return false
    }
    await supabase.from("gamification").upsert(
      { user_id: userId, xp: 0, level: 1, streak: 0, best_streak: 0, pass_rate: 0, study_minutes: 0, lessons_done: 0 },
      { onConflict: "user_id", ignoreDuplicates: true }
    )
    console.log("[async] Provisioned missing user:", userId)
    return true
  } catch (e) {
    console.error("[async] User provision failed:", getErrorMessage(e))
    return false
  }
}

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
    // Fail fast: without a job row the client can never track this generation,
    // and polling would silently time out 10 minutes later.
    return NextResponse.json({ error: "We couldn't start generation (database unavailable). Please try again in a minute." }, { status: 503 })
  }
  console.log("[async] Created job record:", jobId)

  // The roadmap insert FK-requires a users row — heal it if the webhook missed
  if (!(await ensureUserProvisioned(supabase, userId))) {
    await supabase.from("async_jobs").upsert({
      id: jobId,
      status: "failed",
      error: "Your account isn't fully set up yet. Please sign out and sign in again, then retry.",
      completed_at: new Date().toISOString()
    }, { onConflict: "id" })
    return NextResponse.json({ error: "Your account isn't fully set up yet. Please sign out and sign in again, then retry." }, { status: 503 })
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