import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { nextReviewState } from "@/lib/review"
import type { AssessmentResult } from "@/lib/assessment"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { assessmentId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(assessmentId)) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
  }
  const body = (await req.json().catch(() => null)) as { answers?: unknown } | null
  if (!body?.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) {
    return NextResponse.json({ error: "Submit one selected answer for every question" }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: assessment, error: lookupError } = await supabase
    .from("quiz_assessments")
    .select("lesson_id,mode,submitted_at")
    .eq("id", assessmentId)
    .eq("user_id", userId)
    .single()
  if (lookupError || !assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
  }

  const { data, error } = await supabase.rpc("submit_quiz_assessment", {
    p_assessment_id: assessmentId,
    p_user_id: userId,
    p_answers: body.answers,
  })
  if (error) {
    if (error.message.includes("assessment_expired")) {
      return NextResponse.json({ error: "This quiz expired. Start a new assessment." }, { status: 410 })
    }
    if (error.message.includes("incomplete_or_invalid_answers") || error.message.includes("invalid_answer_count")) {
      return NextResponse.json({ error: "Submit one valid answer for every question" }, { status: 400 })
    }
    console.error("[assessments] Submission failed:", error.message)
    return NextResponse.json({ error: "Could not grade assessment" }, { status: 500 })
  }

  const result = data as AssessmentResult
  if (assessment.submitted_at || (data as AssessmentResult & { duplicate?: boolean }).duplicate) {
    return NextResponse.json(result)
  }
  if (assessment.lesson_id && assessment.mode !== "challenge") {
    const today = new Date().toISOString().slice(0, 10)
    // Look up the existing schedule first: passing advances it, and a
    // first-time pass must CREATE it. Previously the pass branch only ran
    // `if (schedule)`, so a learner who never failed never got a review.
    const { data: schedule } = await supabase
      .from("review_schedule")
      .select("topic,repetitions")
      .eq("user_id", userId)
      .eq("lesson_id", assessment.lesson_id)
      .maybeSingle()
    let topic = schedule?.topic ?? null
    if (!topic) {
      const { data: lesson } = await supabase
        .from("lessons")
        .select("title")
        .eq("id", assessment.lesson_id)
        .single()
      topic = lesson?.title ?? null
    }
    if (topic) {
      const next = nextReviewState({
        passed: result.passed,
        today,
        score: result.score,
        previousRepetitions: schedule?.repetitions ?? 0,
      })
      const { error: reviewError } = await supabase.from("review_schedule").upsert({
        user_id: userId,
        lesson_id: assessment.lesson_id,
        topic,
        interval_days: next.intervalDays,
        repetitions: next.repetitions,
        next_review_at: next.nextReviewAt,
        last_score: next.lastScore,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,lesson_id" })
      if (reviewError) console.error("[assessments] Failed to update review schedule:", reviewError.message)
    }
  }

  return NextResponse.json(result)
}
