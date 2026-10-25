import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { inngest } from "@/lib/inngest/client"
import { eligiblePracticeTopics, type ProposedPracticeTopic, type WeakTopicSignal } from "@/lib/replan-proposals"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const supabase = createServerClient()
  const { data: roadmap, error: roadmapError } = await supabase.from("roadmaps").select("id").eq("id", id).eq("user_id", userId).single()
  if (roadmapError || !roadmap) {
    return NextResponse.json({ error: "Roadmap not found" }, { status: 404 })
  }

  const [{ data: lessons, error: lessonsError }, { data: weakTopics, error: weakTopicsError }, { data: revisions, error: revisionsError }, { data: pending, error: pendingError }] = await Promise.all([
    supabase.from("lessons").select("title").eq("roadmap_id", id),
    supabase.from("weak_topics").select("topic,fail_count").eq("user_id", userId).gte("fail_count", 3),
    supabase.from("roadmap_revisions").select("changes").eq("roadmap_id", id).eq("user_id", userId),
    supabase.from("replan_proposals").select("*").eq("roadmap_id", id).eq("user_id", userId).eq("status", "pending").order("created_at", { ascending: false }).limit(1),
  ])
  if (lessonsError || weakTopicsError || revisionsError || pendingError) {
    return NextResponse.json({ error: "Failed to build an adaptation proposal" }, { status: 500 })
  }
  const previousTopics = (revisions ?? []).flatMap((revision) => {
    const changes = revision.changes as { topics?: unknown } | null
    return Array.isArray(changes?.topics) ? changes.topics.filter((topic): topic is string => typeof topic === "string") : []
  })
  const recommendations: ProposedPracticeTopic[] = eligiblePracticeTopics(
    (lessons ?? []).map((lesson) => lesson.title),
    (weakTopics ?? []) as WeakTopicSignal[],
    previousTopics
  ).slice(0, 8)

  if (pending?.[0]) return NextResponse.json({ ok: true, proposal: pending[0], existing: true })
  if (recommendations.length === 0) {
    return NextResponse.json({ error: "No repeated weak topics in this roadmap are ready for a focused-practice proposal." }, { status: 409 })
  }

  const reason = `Repeated quiz difficulties show a need for additional practice in ${recommendations.map((topic) => topic.topic).join(", ")}.`
  const { data: proposal, error: proposalError } = await supabase.from("replan_proposals").insert({
    roadmap_id: id,
    user_id: userId,
    reason,
    proposed_changes: { type: "focused-practice", topics: recommendations },
    status: "pending",
  }).select().single()
  if (proposalError || !proposal) {
    return NextResponse.json({ error: "Failed to save the adaptation proposal" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, proposal })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { proposalId?: string; status?: "approved" | "rejected"; retryJobIds?: string[] }
  if (!body.proposalId || !["approved", "rejected"].includes(body.status ?? "")) {
    return NextResponse.json({ error: "Missing or invalid proposal decision" }, { status: 400 })
  }
  const supabase = createServerClient()
  const { data: proposal, error: proposalError } = await supabase
    .from("replan_proposals")
    .select("id,proposed_changes,status")
    .eq("id", body.proposalId)
    .eq("roadmap_id", id)
    .eq("user_id", userId)
    .single()
  if (proposalError || !proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 })

  if (body.status === "rejected") {
    if (proposal.status !== "pending") return NextResponse.json({ error: "Proposal is no longer pending" }, { status: 409 })
    const { data: dismissed, error } = await supabase.from("replan_proposals")
      .update({ status: "rejected", decided_at: new Date().toISOString() })
      .eq("id", body.proposalId).eq("user_id", userId).eq("status", "pending")
      .select("id").maybeSingle()
    if (error) return NextResponse.json({ error: "Failed to dismiss proposal" }, { status: 500 })
    if (!dismissed) return NextResponse.json({ error: "Proposal is no longer pending" }, { status: 409 })
    return NextResponse.json({ ok: true })
  }

  if (proposal.status === "applied" && !Array.isArray(body.retryJobIds)) {
    return NextResponse.json({ error: "Only failed lesson-generation jobs can be retried" }, { status: 409 })
  }
  if (proposal.status !== "pending" && proposal.status !== "applied") {
    return NextResponse.json({ error: "Proposal is no longer available" }, { status: 409 })
  }
  if (body.retryJobIds !== undefined && (
    proposal.status !== "applied"
    || body.retryJobIds.length === 0
    || body.retryJobIds.some((jobId) => typeof jobId !== "string")
    || new Set(body.retryJobIds).size !== body.retryJobIds.length
  )) {
    return NextResponse.json({ error: "Retry request contains invalid job identifiers" }, { status: 400 })
  }

  const { data: application, error: applyError } = await supabase.rpc("apply_replan_proposal", {
    p_proposal_id: body.proposalId,
    p_user_id: userId,
  })
  if (applyError || !application) {
    console.error("[replan] Failed to apply proposal:", applyError?.message ?? "No result")
    return NextResponse.json({ error: "The proposal could not be applied. Refresh and try again." }, { status: 409 })
  }

  const result = application as { jobs?: { jobId: string; lessonId: string }[]; duplicate?: boolean }
  const allJobs = result.jobs ?? []
  const requestedJobIds = body.retryJobIds ? new Set(body.retryJobIds) : null
  const jobs = requestedJobIds
    ? allJobs.filter((job) => requestedJobIds.has(job.jobId))
    : result.duplicate ? [] : allJobs
  if (requestedJobIds && jobs.length !== requestedJobIds.size) {
    return NextResponse.json({ error: "Retry request contains an invalid job identifier" }, { status: 400 })
  }
  const dispatches = await Promise.all(jobs.map(async ({ jobId, lessonId }) => {
    try {
      await inngest.send({ name: "lesson/generate", data: { jobId, lessonId, userId } })
      return null
    } catch {
      return jobId
    }
  }))
  const failedJobIds = dispatches.filter((jobId): jobId is string => jobId !== null)
  if (failedJobIds.length > 0) {
    console.error(`[replan] ${failedJobIds.length} of ${jobs.length} lesson-generation events failed to enqueue for proposal ${body.proposalId}`)
  }
  return NextResponse.json({
    ok: true,
    applied: true,
    generationQueued: failedJobIds.length === 0,
    failedJobIds,
    application,
  })
}
