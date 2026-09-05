import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { auth } from "@clerk/nextjs/server"

const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY
const NVIDIA_NIM_BASE_URL = process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1"

interface GenerateQuizRequest {
  lessonId: string
  conceptTags: string[]
  difficulty: "easy" | "medium" | "hard"
  questionCount?: number
  type?: "multiple-choice" | "code" | "short-answer"
}

async function generateQuizWithNIM(data: GenerateQuizRequest) {
  const questionCount = data.questionCount || 5
  const type = data.type || "multiple-choice"

  const prompt = `You are an expert quiz creator. Generate ${questionCount} ${type} questions for a lesson covering these concepts: ${data.conceptTags.join(", ")}.

Difficulty: ${data.difficulty}

Requirements:
1. Questions should test understanding of the listed concepts
2. Difficulty should match: ${data.difficulty}
3. For multiple-choice: provide 4 options with 1 correct answer
4. For code: provide a code snippet with a bug or missing part
5. For short-answer: ask for a concise explanation
6. Include explanations for correct answers
7. Output as structured JSON

JSON Schema:
{
  "questions": [
    {
      "type": "${type}",
      "prompt": "string",
      "options": ["string"] | null,
      "correctAnswer": "string",
      "explanation": "string",
      "difficulty": "${data.difficulty}",
      "conceptTags": ["string"]
    }
  ]
}`

  const response = await fetch(`${NVIDIA_NIM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NVIDIA_NIM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "meta/llama-3.1-70b-instruct",
      messages: [
        { role: "system", content: "You are an expert quiz creator. Output only valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`NIM API error: ${error}`)
  }

  const result = await response.json()
  const content = result.choices[0]?.message?.content
  
  if (!content) {
    throw new Error("No content returned from NIM")
  }

  return JSON.parse(content)
}

function generateFallbackQuiz(data: GenerateQuizRequest) {
  const concepts = data.conceptTags
  const questions: Array<{
    type: string
    prompt: string
    options: string[]
    correctAnswer: string
    explanation: string
    difficulty: string
    conceptTags: string[]
  }> = []

  for (let i = 0; i < (data.questionCount || 5); i++) {
    const concept = concepts[i % concepts.length]
    questions.push({
      type: data.type || "multiple-choice",
      prompt: `What is a key characteristic of ${concept}?`,
      options: [
        `It is a fundamental concept in ${concept}`,
        `It is unrelated to ${concept}`,
        `It is an advanced topic only`,
        `It is deprecated`
      ],
      correctAnswer: `It is a fundamental concept in ${concept}`,
      explanation: `${concept} is a core concept that forms the foundation for more advanced topics.`,
      difficulty: data.difficulty,
      conceptTags: [concept],
    })
  }

  return { questions }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { lessonId, conceptTags, difficulty, questionCount, type }: GenerateQuizRequest = body

    if (!lessonId || !conceptTags || !difficulty) {
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

    // Verify lesson exists and user has access
    const { data: lesson, error: lessonError } = await supabase
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
      .eq("id", lessonId)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    // Check ownership through the chain
    const module = Array.isArray(lesson.roadmap_modules) ? lesson.roadmap_modules[0] : lesson.roadmap_modules
    const phase = Array.isArray(module?.roadmap_phases) ? module?.roadmap_phases[0] : module?.roadmap_phases
    const roadmap = Array.isArray(phase?.roadmaps) ? phase?.roadmaps[0] : phase?.roadmaps
    const roadmapUserId = roadmap?.user_id
    if (roadmapUserId !== profile.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Get or create quiz for this lesson
    let { data: quiz } = await supabase
      .from("quizzes")
      .select("id")
      .eq("lesson_id", lessonId)
      .single()

    if (!quiz) {
      const { data: newQuiz, error: quizError } = await supabase
        .from("quizzes")
        .insert({
          lesson_id: lessonId,
          type: type || "multiple-choice",
          difficulty,
        })
        .select("id")
        .single()

      if (quizError) throw quizError
      quiz = newQuiz
    }

    // Generate questions using NVIDIA NIM
    let quizData
    try {
      quizData = await generateQuizWithNIM({ lessonId, conceptTags, difficulty, questionCount, type })
    } catch (nimError) {
      console.error("NIM quiz generation failed:", nimError)
      quizData = generateFallbackQuiz({ lessonId, conceptTags, difficulty, questionCount, type })
    }

    // Insert questions
    const questionsToInsert = quizData.questions.map((q: any, index: number) => ({
      quiz_id: quiz.id,
      type: q.type,
      prompt: q.prompt,
      options: q.options || null,
      correct_answer: q.correctAnswer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      concept_tags: q.conceptTags,
    }))

    // Delete existing questions first
    await supabase
      .from("questions")
      .delete()
      .eq("quiz_id", quiz.id)

    const { error: questionsError } = await supabase
      .from("questions")
      .insert(questionsToInsert)

    if (questionsError) throw questionsError

    // Fetch the created questions
    const { data: questions } = await supabase
      .from("questions")
      .select("*")
      .eq("quiz_id", quiz.id)
      .order("created_at", { ascending: true })

    return NextResponse.json({
      success: true,
      quizId: quiz.id,
      questions: questions || [],
    })
  } catch (error) {
    console.error("Quiz generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate quiz" },
      { status: 500 }
    )
  }
}