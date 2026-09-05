import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { auth } from "@clerk/nextjs/server"

interface SubmitQuizRequest {
  quizId: string
  answers: Record<string, string> // questionId -> answer
  timeSpent: number // in seconds
}

interface WeaknessAnalysis {
  weakConcepts: string[]
  strongConcepts: string[]
  recommendedReview: string[]
  adaptationTriggered: boolean
}

async function analyzeWeakness(
  questions: any[],
  answers: Record<string, string>
): Promise<WeaknessAnalysis> {
  const conceptScores: Record<string, { correct: number; total: number }> = {}

  questions.forEach((q) => {
    const userAnswer = answers[q.id]
    const isCorrect = userAnswer === q.correct_answer
    
    q.concept_tags.forEach((concept: string) => {
      if (!conceptScores[concept]) {
        conceptScores[concept] = { correct: 0, total: 0 }
      }
      conceptScores[concept].total++
      if (isCorrect) conceptScores[concept].correct++
    })
  })

  const weakConcepts: string[] = []
  const strongConcepts: string[] = []
  const recommendedReview: string[] = []

  Object.entries(conceptScores).forEach(([concept, scores]) => {
    const accuracy = scores.correct / scores.total
    if (accuracy < 0.6) {
      weakConcepts.push(concept)
      recommendedReview.push(`Review ${concept} - scored ${Math.round(accuracy * 100)}%`)
    } else if (accuracy >= 0.8) {
      strongConcepts.push(concept)
    }
  })

  // Trigger adaptation if more than 40% of concepts are weak
  const adaptationTriggered = weakConcepts.length > 0 && 
    (weakConcepts.length / Object.keys(conceptScores).length) > 0.4

  return {
    weakConcepts,
    strongConcepts,
    recommendedReview,
    adaptationTriggered,
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { quizId, answers, timeSpent }: SubmitQuizRequest = body

    if (
      typeof quizId !== "string" ||
      !quizId ||
      !answers ||
      typeof answers !== "object" ||
      Array.isArray(answers) ||
      typeof timeSpent !== "number" ||
      !Number.isFinite(timeSpent) ||
      timeSpent < 0
    ) {
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

    // Get quiz with questions
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select(`
        id,
        lesson_id,
        type,
        difficulty,
        questions (
          id,
          type,
          prompt,
          options,
          correct_answer,
          explanation,
          difficulty,
          concept_tags
        )
      `)
      .eq("id", quizId)
      .single()

    if (quizError || !quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    // Verify user has access to this quiz through lesson ownership
    const { data: lesson } = await supabase
      .from("lessons")
      .select(`
        id,
        module_id,
        roadmap_modules!inner (
          phase_id,
          roadmap_phases!inner (
            roadmap_id,
            roadmaps!inner (user_id)
          )
        )
      `)
      .eq("id", quiz.lesson_id)
      .single()

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    const module = Array.isArray(lesson.roadmap_modules) ? lesson.roadmap_modules[0] : lesson.roadmap_modules
    const phase = Array.isArray(module?.roadmap_phases) ? module?.roadmap_phases[0] : module?.roadmap_phases
    const roadmap = Array.isArray(phase?.roadmaps) ? phase?.roadmaps[0] : phase?.roadmaps
    const roadmapUserId = roadmap?.user_id
    if (roadmapUserId !== profile.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Calculate score
    let correctCount = 0
    const questionResults = quiz.questions.map((q: any) => {
      const userAnswer = answers[q.id]
      const isCorrect = userAnswer === q.correct_answer
      if (isCorrect) correctCount++
      return {
        questionId: q.id,
        userAnswer,
        correctAnswer: q.correct_answer,
        isCorrect,
        explanation: q.explanation,
        conceptTags: q.concept_tags,
      }
    })

    const score = quiz.questions.length > 0 
      ? Math.round((correctCount / quiz.questions.length) * 100) 
      : 0

    // Analyze weaknesses
    const weaknessAnalysis = await analyzeWeakness(quiz.questions, answers)

    // Save quiz attempt
    const { data: attempt, error: attemptError } = await supabase
      .from("quiz_attempts")
      .insert({
        user_id: profile.id,
        quiz_id: quizId,
        score,
        answers,
        time_spent: timeSpent,
        weakness_analysis: weaknessAnalysis,
      })
      .select("id")
      .single()

    if (attemptError) throw attemptError

    // Update user concepts mastery
    for (const question of quiz.questions) {
      const userAnswer = answers[question.id]
      const isCorrect = userAnswer === question.correct_answer
      
      for (const concept of question.concept_tags) {
        const { data: existingConcept } = await supabase
          .from("user_concepts")
          .select("*")
          .eq("user_id", profile.id)
          .eq("concept", concept)
          .single()

        if (existingConcept) {
          const newTotalAttempts = existingConcept.total_attempts + 1
          const newCorrectAttempts = existingConcept.correct_attempts + (isCorrect ? 1 : 0)
          const newMasteryLevel = Math.round((newCorrectAttempts / newTotalAttempts) * 100)
          
          // Calculate next review using spaced repetition (simplified SM-2)
          const easeFactor = Math.max(1.3, existingConcept.mastery_level / 100 * 2.5 + 1.3)
          const interval = isCorrect 
            ? Math.max(1, Math.round(existingConcept.total_attempts * easeFactor))
            : 1
          const nextReview = new Date()
          nextReview.setDate(nextReview.getDate() + interval)

          await supabase
            .from("user_concepts")
            .update({
              mastery_level: newMasteryLevel,
              total_attempts: newTotalAttempts,
              correct_attempts: newCorrectAttempts,
              last_reviewed: new Date().toISOString(),
              next_review: nextReview.toISOString(),
            })
            .eq("id", existingConcept.id)
        } else {
          // First time seeing this concept
          const nextReview = new Date()
          nextReview.setDate(nextReview.getDate() + 1)
          
          await supabase
            .from("user_concepts")
            .insert({
              user_id: profile.id,
              concept,
              mastery_level: isCorrect ? 100 : 0,
              total_attempts: 1,
              correct_attempts: isCorrect ? 1 : 0,
              last_reviewed: new Date().toISOString(),
              next_review: nextReview.toISOString(),
            })
        }
      }
    }

    // Check if lesson should be marked complete (score >= 70%)
    if (score >= 70) {
      await supabase
        .from("lessons")
        .update({ completed: true })
        .eq("id", quiz.lesson_id)
    }

    // Record study session
    const module2 = lesson.roadmap_modules as unknown as Array<{
      roadmap_phases?: Array<{
        roadmaps?: Array<{ id: string }>
      }>
    }> | undefined
    const phase2 = module2?.[0]?.roadmap_phases?.[0]
    const roadmap2 = phase2?.roadmaps?.[0]
    await supabase
      .from("study_sessions")
      .insert({
        user_id: profile.id,
        roadmap_id: roadmap2?.id,
        lesson_id: quiz.lesson_id,
        duration: timeSpent,
        activity_type: "quiz",
      })

    return NextResponse.json({
      success: true,
      attemptId: attempt.id,
      score,
      correctCount,
      totalQuestions: quiz.questions.length,
      questionResults,
      weaknessAnalysis,
      lessonCompleted: score >= 70,
    })
  } catch (error) {
    console.error("Quiz submit error:", error)
    return NextResponse.json(
      { error: "Failed to submit quiz" },
      { status: 500 }
    )
  }
}