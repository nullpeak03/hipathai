import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { auth } from "@clerk/nextjs/server"

const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY
const NVIDIA_NIM_BASE_URL = process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1"

interface GenerateRequest {
  roadmapId: string
  topic: string
  description?: string
  difficulty: "beginner" | "intermediate" | "advanced"
  duration: "short" | "medium" | "long"
}

async function generateRoadmapWithNIM(data: GenerateRequest) {
  const durationHours = {
    short: 15,
    medium: 45,
    long: 80
  }

  const prompt = `You are an expert learning path designer. Create a comprehensive, adaptive learning roadmap based on the following:

**Topic:** ${data.topic}
**Description:** ${data.description || `A comprehensive roadmap to learn ${data.topic}`}
**Difficulty:** ${data.difficulty}
**Target Duration:** ~${durationHours[data.duration]} hours

**Requirements:**
1. Create 4-6 phases, each with a clear theme
2. Each phase should have 3-5 modules
3. Each module should have 3-5 lessons
4. Include estimated time for each phase/module/lesson
5. Include quiz recommendations for each module
6. Make it adaptive - note which concepts build on others
7. Consider the difficulty level and available time
8. Output as structured JSON

**JSON Schema:**
{
  "title": "string",
  "description": "string",
  "estimatedTotalHours": number,
  "phases": [
    {
      "title": "string",
      "description": "string",
      "order": number,
      "estimatedHours": number,
      "modules": [
        {
          "title": "string",
          "description": "string",
          "order": number,
          "estimatedMinutes": number,
          "lessons": [
            {
              "title": "string",
              "contentType": "video|article|interactive|quiz|project",
              "order": number,
              "estimatedMinutes": number,
              "concepts": ["string"],
              "quizRecommended": boolean
            }
          ]
        }
      ]
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
        { role: "system", content: "You are an expert learning path designer. Output only valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
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

function generateFallbackRoadmap(data: GenerateRequest) {
  const durationHours = { short: 15, medium: 45, long: 80 }
  const totalHours = durationHours[data.duration]
  
  return {
    title: `${data.topic} Learning Path`,
    description: data.description || `A personalized roadmap to master ${data.topic}. Designed for ${data.difficulty} level learners.`,
    estimatedTotalHours: totalHours,
    phases: [
      {
        title: "Foundations",
        description: "Build a strong foundation in core concepts",
        order: 1,
        estimatedHours: Math.round(totalHours * 0.25),
        modules: [
          {
            title: "Core Concepts",
            description: "Essential fundamentals and terminology",
            order: 1,
            estimatedMinutes: 90,
            lessons: [
              { title: "Introduction & Overview", contentType: "video", order: 1, estimatedMinutes: 20, concepts: ["basics", "overview"], quizRecommended: true },
              { title: "Key Terminology & Concepts", contentType: "article", order: 2, estimatedMinutes: 25, concepts: ["terminology"], quizRecommended: true },
              { title: "Environment Setup", contentType: "interactive", order: 3, estimatedMinutes: 25, concepts: ["setup", "environment"], quizRecommended: false },
              { title: "First Hands-on Exercise", contentType: "interactive", order: 4, estimatedMinutes: 20, concepts: ["first-steps"], quizRecommended: true },
            ],
          },
        ],
      },
      {
        title: "Core Skills Development",
        description: "Develop practical skills through hands-on practice",
        order: 2,
        estimatedHours: Math.round(totalHours * 0.4),
        modules: [
          {
            title: "Practical Applications",
            description: "Apply concepts to real-world problems",
            order: 1,
            estimatedMinutes: 180,
            lessons: [
              { title: "Guided Project 1", contentType: "project", order: 1, estimatedMinutes: 60, concepts: ["project-1", "application"], quizRecommended: false },
              { title: "Deep Dive: Core Concept", contentType: "video", order: 2, estimatedMinutes: 45, concepts: ["deep-dive", "core"], quizRecommended: true },
              { title: "Practice Exercises", contentType: "interactive", order: 3, estimatedMinutes: 45, concepts: ["practice", "exercises"], quizRecommended: true },
              { title: "Code Review & Best Practices", contentType: "article", order: 4, estimatedMinutes: 30, concepts: ["patterns", "best-practices"], quizRecommended: true },
            ],
          },
        ],
      },
      {
        title: "Advanced Topics",
        description: "Master advanced concepts and professional techniques",
        order: 3,
        estimatedHours: Math.round(totalHours * 0.25),
        modules: [
          {
            title: "Advanced Patterns",
            description: "Professional-level techniques and optimizations",
            order: 1,
            estimatedMinutes: 150,
            lessons: [
              { title: "Advanced Patterns & Techniques", contentType: "video", order: 1, estimatedMinutes: 45, concepts: ["advanced", "patterns"], quizRecommended: true },
              { title: "Performance Optimization", contentType: "article", order: 2, estimatedMinutes: 30, concepts: ["performance", "optimization"], quizRecommended: true },
              { title: "Capstone Project", contentType: "project", order: 3, estimatedMinutes: 75, concepts: ["capstone", "integration"], quizRecommended: false },
            ],
          },
        ],
      },
      {
        title: "Mastery & Specialization",
        description: "Specialize and achieve mastery in your chosen area",
        order: 4,
        estimatedHours: Math.round(totalHours * 0.1),
        modules: [
          {
            title: "Specialization Topics",
            description: "Dive deep into specialized areas",
            order: 1,
            estimatedMinutes: 60,
            lessons: [
              { title: "Specialization Overview", contentType: "video", order: 1, estimatedMinutes: 20, concepts: ["specialization"], quizRecommended: true },
              { title: "Advanced Project", contentType: "project", order: 2, estimatedMinutes: 40, concepts: ["advanced-project"], quizRecommended: false },
            ],
          },
        ],
      },
    ],
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { roadmapId, topic, description, difficulty, duration }: GenerateRequest = body

    if (!roadmapId || !topic || !difficulty || !duration) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createClient()

    // Verify roadmap belongs to user
    const { data: roadmap, error: roadmapError } = await supabase
      .from("roadmaps")
      .select("id, user_id")
      .eq("id", roadmapId)
      .single()

    if (roadmapError || !roadmap) {
      return NextResponse.json({ error: "Roadmap not found" }, { status: 404 })
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_id", userId)
      .single()

    if (!profile || roadmap.user_id !== profile.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Update roadmap status to generating
    await supabase
      .from("roadmaps")
      .update({ status: "generating" })
      .eq("id", roadmapId)

    // Generate roadmap using NVIDIA NIM
    let roadmapData
    try {
      roadmapData = await generateRoadmapWithNIM({ roadmapId, topic, description, difficulty, duration })
    } catch (nimError) {
      console.error("NIM generation failed:", nimError)
      roadmapData = generateFallbackRoadmap({ roadmapId, topic, description, difficulty, duration })
    }

    // Update roadmap with generated data
    await supabase
      .from("roadmaps")
      .update({
        title: roadmapData.title,
        description: roadmapData.description,
        status: "active",
      })
      .eq("id", roadmapId)

    // Create phases, modules, lessons
    for (const phase of roadmapData.phases) {
      const { data: phaseData, error: phaseError } = await supabase
        .from("roadmap_phases")
        .insert({
          roadmap_id: roadmapId,
          title: phase.title,
          description: phase.description,
          order_index: phase.order,
          estimated_hours: phase.estimatedHours,
        })
        .select("id")
        .single()

      if (phaseError) throw phaseError

      for (const module of phase.modules) {
        const { data: moduleData, error: moduleError } = await supabase
          .from("roadmap_modules")
          .insert({
            phase_id: phaseData.id,
            title: module.title,
            description: module.description,
            order_index: module.order,
            estimated_minutes: module.estimatedMinutes,
          })
          .select("id")
          .single()

        if (moduleError) throw moduleError

        for (const lesson of module.lessons) {
          const { data: lessonData, error: lessonError } = await supabase
            .from("lessons")
            .insert({
              module_id: moduleData.id,
              title: lesson.title,
              content_type: lesson.contentType,
              content_data: { concepts: lesson.concepts },
              order_index: lesson.order,
              estimated_minutes: lesson.estimatedMinutes,
            })
            .select("id")
            .single()

          if (lessonError) throw lessonError

          // Create quiz if recommended
          if (lesson.quizRecommended) {
            const { error: quizError } = await supabase
              .from("quizzes")
              .insert({
                lesson_id: lessonData.id,
                type: "multiple-choice",
                difficulty: difficulty === "beginner" ? "easy" : difficulty === "intermediate" ? "medium" : "hard",
              })

            if (quizError) console.error("Quiz creation failed:", quizError)
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      roadmapId,
      redirectUrl: `/dashboard/roadmaps/${roadmapId}`
    })
  } catch (error) {
    console.error("Roadmap generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate roadmap" },
      { status: 500 }
    )
  }
}