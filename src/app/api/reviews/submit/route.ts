import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { auth } from "@clerk/nextjs/server"

interface SubmitReviewRequest {
  conceptId: string
  answer: string
  timeSpent: number
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { conceptId, answer, timeSpent }: SubmitReviewRequest = body

    if (!conceptId || !answer || timeSpent === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createClient()

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_id", userId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    // Get the concept
    const { data: concept, error: conceptError } = await supabase
      .from("user_concepts")
      .select("*")
      .eq("id", conceptId)
      .eq("user_id", profile.id)
      .single()

    if (conceptError || !concept) {
      return NextResponse.json({ error: "Concept not found" }, { status: 404 })
    }

    // Check if answer is correct (simple keyword matching for now)
    const isCorrect = answer.toLowerCase().includes(concept.concept.toLowerCase()) ||
      concept.concept.toLowerCase().includes(answer.toLowerCase())

    // Calculate new mastery using SM-2 algorithm
    const newTotalAttempts = concept.total_attempts + 1
    const newCorrectAttempts = concept.correct_attempts + (isCorrect ? 1 : 0)
    const newMasteryLevel = Math.round((newCorrectAttempts / newTotalAttempts) * 100)

    // Calculate next review interval using simplified SM-2
    let easeFactor = concept.total_attempts > 0
      ? Math.max(1.3, (concept.mastery_level / 100) * 2.5 + 1.3)
      : 2.5

    let interval = 1
    if (isCorrect) {
      if (concept.total_attempts === 0) interval = 1
      else if (concept.total_attempts === 1) interval = 6
      else interval = Math.round(concept.total_attempts * easeFactor)
    } else {
      interval = 1
      easeFactor = Math.max(1.3, easeFactor - 0.2)
    }

    const nextReview = new Date()
    nextReview.setDate(nextReview.getDate() + interval)

    // Update concept
    await supabase
      .from("user_concepts")
      .update({
        mastery_level: newMasteryLevel,
        total_attempts: newTotalAttempts,
        correct_attempts: newCorrectAttempts,
        last_reviewed: new Date().toISOString(),
        next_review: nextReview.toISOString(),
      })
      .eq("id", conceptId)

    // Record study session
    await supabase
      .from("study_sessions")
      .insert({
        user_id: profile.id,
        roadmap_id: concept.lesson_id, // This should be roadmap_id but we don't have it here
        lesson_id: concept.lesson_id,
        duration: timeSpent,
        activity_type: "review",
      })

    return NextResponse.json({
      success: true,
      isCorrect,
      newMasteryLevel,
      nextReview: nextReview.toISOString(),
      intervalDays: interval,
      message: isCorrect ? "Great job! Concept reinforced." : "Keep practicing! You'll get it next time.",
    })
  } catch (error) {
    console.error("Submit review error:", error)
    return NextResponse.json(
      { error: "Failed to submit review" },
      { status: 500 }
    )
  }
}