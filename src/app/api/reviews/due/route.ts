import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { auth } from "@clerk/nextjs/server"

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

    // Get due concepts for review
    const now = new Date().toISOString()
    const { data: dueConcepts, error } = await supabase
      .from("user_concepts")
      .select(`
        id,
        concept,
        mastery_level,
        total_attempts,
        correct_attempts,
        last_reviewed,
        next_review,
        lesson_id,
        lessons (
          id,
          title,
          module_id,
          roadmap_modules!inner (
            phase_id,
            roadmap_phases!inner (
              roadmap_id,
              roadmaps!inner (title)
            )
          )
        )
      `)
      .eq("user_id", profile.id)
      .lte("next_review", now)
      .order("next_review", { ascending: true })
      .limit(20)

    if (error) throw error

    // Generate review questions for each due concept
    const reviews = await Promise.all(
      (dueConcepts || []).map(async (concept) => {
        // Fetch or generate a review question for this concept
        const { data: quiz } = await supabase
          .from("quizzes")
          .select(`
            id,
            questions (
              id,
              prompt,
              options,
              correct_answer,
              explanation,
              type,
              difficulty
            )
          `)
          .eq("lesson_id", concept.lesson_id)
          .single()

        let question: {
          id: string
          prompt: string
          type: string
          correct_answer: string
          explanation: string
          difficulty: string
          options: string[] | null
        } | null = null
        if (quiz?.questions?.length > 0) {
          // Find a question related to this concept
          const relevantQuestions = quiz.questions.filter((q: any) =>
            q.concept_tags?.includes(concept.concept)
          )
          question = relevantQuestions[0] || quiz.questions[0]
        }

        // If no existing question, generate a simple review question
        if (!question) {
          question = {
            id: `review-${concept.id}`,
            prompt: `Review: What is a key concept of ${concept.concept}?`,
            type: "short_answer",
            correct_answer: concept.concept,
            explanation: `${concept.concept} is a concept you've studied before. This review helps reinforce your understanding.`,
            difficulty: "easy",
            options: null,
          }
        }

        return {
          id: concept.id,
          concept: concept.concept,
          masteryLevel: concept.mastery_level,
          totalAttempts: concept.total_attempts,
          correctAttempts: concept.correct_attempts,
          lastReviewed: concept.last_reviewed,
          nextReview: concept.next_review,
          lessonTitle: concept.lessons?.title,
          roadmapTitle: concept.lessons?.roadmap_modules?.[0]?.roadmap_phases?.[0]?.roadmaps?.title,
          question,
        }
      })
    )

    return NextResponse.json({
      success: true,
      reviews,
      count: reviews.length,
    })
  } catch (error) {
    console.error("Get due reviews error:", error)
    return NextResponse.json(
      { error: "Failed to fetch due reviews" },
      { status: 500 }
    )
  }
}