import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { auth } from "@clerk/nextjs/server"

const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY
const NVIDIA_NIM_BASE_URL = process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1"
const NVIDIA_NIM_MODEL = process.env.NVIDIA_NIM_MODEL || "nvidia/nemotron-3-ultra-550b-a55b"

interface OnboardingData {
  currentRole: string
  careerGoal: string
  learningObjective: string
  skillLevel: "beginner" | "intermediate" | "advanced"
  hoursPerWeek: "light" | "moderate" | "intensive"
  dailyMinutes?: number
  contentFormat: string[]
  topicsOfInterest: string[]
}

async function generateRoadmapWithNIM(data: OnboardingData, attempt = 0) {
  if (!NVIDIA_NIM_API_KEY) {
    throw new Error("NVIDIA_NIM_API_KEY is not configured")
  }

  const prompt = `You are an expert learning path designer. Create a comprehensive, adaptive learning roadmap based on the following user profile:

**User Profile:**
- Current Role: ${data.currentRole}
- Career Goal: ${data.careerGoal}
- Learning Objective: ${data.learningObjective}
- Skill Level: ${data.skillLevel}
- Hours per Week: ${data.hoursPerWeek}
- Daily Study Time: ${data.dailyMinutes || "Not specified"} minutes per day
- Preferred Content Formats: ${data.contentFormat.join(", ")}
- Topics of Interest: ${data.topicsOfInterest.join(", ")}

**Requirements:**
1. Create 4-6 phases, each with a clear theme
2. Each phase should have 3-5 modules
3. Each module should have 3-5 lessons
4. Include estimated time for each phase/module/lesson
5. Include quiz recommendations for each module
6. Make it adaptive - note which concepts build on others
7. Consider the user's skill level and available time
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
    signal: AbortSignal.timeout(120_000),
    headers: {
      "Authorization": `Bearer ${NVIDIA_NIM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: NVIDIA_NIM_MODEL,
      messages: [
        { role: "system", content: "You are an expert learning path designer. Output only valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 12000,
      response_format: { type: "json_object" },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    if (response.status >= 500 && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)))
      return generateRoadmapWithNIM(data, attempt + 1)
    }
    throw new Error(`NIM API error (${response.status}): ${error}`)
  }

  const result = await response.json()
  const content = result.choices[0]?.message?.content
  
  if (!content) {
    throw new Error("No content returned from NIM")
  }

  const jsonContent = content.match(/\{[\s\S]*\}/)?.[0]
  if (!jsonContent) {
    throw new Error("NIM returned no JSON roadmap")
  }

  return JSON.parse(jsonContent)
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const onboardingData: OnboardingData = body

    // Validate required fields
    const requiredFields = ["currentRole", "careerGoal", "learningObjective", "skillLevel", "hoursPerWeek", "contentFormat", "topicsOfInterest"]
    for (const field of requiredFields) {
      if (!onboardingData[field as keyof OnboardingData]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    if (
      onboardingData.dailyMinutes !== undefined &&
      (!Number.isInteger(onboardingData.dailyMinutes) ||
        onboardingData.dailyMinutes < 5 ||
        onboardingData.dailyMinutes > 480)
    ) {
      return NextResponse.json({ error: "Daily study time must be between 5 and 480 minutes" }, { status: 400 })
    }

    const supabase = await createClient()

    // Get or create user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_id", userId)
      .single()

    let profileId = profile?.id

    if (!profileId) {
      const { data: newProfile, error: profileError } = await supabase
        .from("profiles")
        .insert({
          clerk_id: userId,
          theme: "system",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          learning_goals: [onboardingData.careerGoal],
          preferences: {
            skillLevel: onboardingData.skillLevel,
            hoursPerWeek: onboardingData.hoursPerWeek,
            dailyMinutes: onboardingData.dailyMinutes,
            contentFormat: onboardingData.contentFormat,
            topicsOfInterest: onboardingData.topicsOfInterest,
          },
        })
        .select("id")
        .single()

      if (profileError) throw profileError
      profileId = newProfile.id
    } else {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", profileId)
        .single()

      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({
          learning_goals: [onboardingData.careerGoal],
          preferences: {
            ...(existingProfile?.preferences || {}),
            skillLevel: onboardingData.skillLevel,
            hoursPerWeek: onboardingData.hoursPerWeek,
            dailyMinutes: onboardingData.dailyMinutes,
            contentFormat: onboardingData.contentFormat,
            topicsOfInterest: onboardingData.topicsOfInterest,
          },
        })
        .eq("id", profileId)
      if (profileUpdateError) throw profileUpdateError
    }

    // Save onboarding responses
    const { data: onboardingResponse, error: onboardingError } = await supabase
      .from("onboarding_responses")
      .insert({
        user_id: profileId,
        role: onboardingData.currentRole,
        career_goal: onboardingData.careerGoal,
        learning_objective: onboardingData.learningObjective,
        skill_level: onboardingData.skillLevel,
        hours_per_week: onboardingData.hoursPerWeek,
        content_format: onboardingData.contentFormat,
        topics_of_interest: onboardingData.topicsOfInterest,
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (onboardingError) throw onboardingError

    // Generate roadmap using NVIDIA NIM
    let roadmapData
    let aiGenerated = true
    try {
      roadmapData = await generateRoadmapWithNIM(onboardingData)
    } catch (nimError) {
      console.error("NIM generation failed:", nimError)
      aiGenerated = false
      roadmapData = generateFallbackRoadmap(onboardingData)
    }

    // Create roadmap in database
    const { data: roadmap, error: roadmapError } = await supabase
      .from("roadmaps")
      .insert({
        user_id: profileId,
        title: roadmapData.title,
        topic: onboardingData.topicsOfInterest.join(", "),
        description: roadmapData.description,
        status: "active",
        current_phase: 1,
        version: 1,
      })
      .select("id")
      .single()

    if (roadmapError) throw roadmapError

    // Create phases, modules, lessons
    for (const phase of roadmapData.phases) {
      const { data: phaseData, error: phaseError } = await supabase
        .from("roadmap_phases")
        .insert({
          roadmap_id: roadmap.id,
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
                difficulty: onboardingData.skillLevel === "beginner" ? "easy" : "medium",
              })

            if (quizError) console.error("Quiz creation failed:", quizError)
          }
        }
      }
    }

    // Update onboarding response with roadmap ID
    await supabase
      .from("onboarding_responses")
      .update({ generated_roadmap_id: roadmap.id })
      .eq("id", onboardingResponse.id)

    return NextResponse.json({ 
      success: true, 
      roadmapId: roadmap.id,
      aiGenerated,
      model: aiGenerated ? NVIDIA_NIM_MODEL : null,
      redirectUrl: `/dashboard/roadmaps/${roadmap.id}`
    })
  } catch (error) {
    console.error("Onboarding error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to complete onboarding" },
      { status: 500 }
    )
  }
}

function generateFallbackRoadmap(data: OnboardingData) {
  const topics = data.topicsOfInterest.slice(0, 3)
  return {
    title: `${data.careerGoal} Learning Path`,
    description: `A personalized roadmap to achieve your goal: ${data.careerGoal}. Focused on ${topics.join(", ")}.`,
    estimatedTotalHours: data.hoursPerWeek === "intensive" ? 80 : data.hoursPerWeek === "moderate" ? 60 : 40,
    phases: [
      {
        title: "Foundations",
        description: "Build a strong foundation in core concepts",
        order: 1,
        estimatedHours: 15,
        modules: [
          {
            title: "Core Concepts",
            description: "Essential fundamentals",
            order: 1,
            estimatedMinutes: 120,
            lessons: [
              { title: "Introduction & Setup", contentType: "video", order: 1, estimatedMinutes: 30, concepts: ["basics"], quizRecommended: true },
              { title: "Key Terminology", contentType: "article", order: 2, estimatedMinutes: 20, concepts: ["terminology"], quizRecommended: true },
              { title: "Environment Setup", contentType: "interactive", order: 3, estimatedMinutes: 30, concepts: ["setup"], quizRecommended: false },
              { title: "First Steps", contentType: "interactive", order: 4, estimatedMinutes: 40, concepts: ["first-steps"], quizRecommended: true },
            ],
          },
        ],
      },
      {
        title: "Core Skills",
        description: "Develop practical skills through hands-on practice",
        order: 2,
        estimatedHours: 20,
        modules: [
          {
            title: "Practical Applications",
            description: "Apply concepts to real problems",
            order: 1,
            estimatedMinutes: 180,
            lessons: [
              { title: "Guided Project 1", contentType: "project", order: 1, estimatedMinutes: 60, concepts: ["project-1"], quizRecommended: false },
              { title: "Deep Dive: Key Concept", contentType: "video", order: 2, estimatedMinutes: 45, concepts: ["deep-dive"], quizRecommended: true },
              { title: "Practice Exercises", contentType: "interactive", order: 3, estimatedMinutes: 45, concepts: ["practice"], quizRecommended: true },
              { title: "Code Review & Patterns", contentType: "article", order: 4, estimatedMinutes: 30, concepts: ["patterns"], quizRecommended: true },
            ],
          },
        ],
      },
      {
        title: "Advanced Topics",
        description: "Master advanced concepts and best practices",
        order: 3,
        estimatedHours: 15,
        modules: [
          {
            title: "Advanced Patterns",
            description: "Professional-level techniques",
            order: 1,
            estimatedMinutes: 150,
            lessons: [
              { title: "Advanced Patterns", contentType: "video", order: 1, estimatedMinutes: 45, concepts: ["advanced"], quizRecommended: true },
              { title: "Performance Optimization", contentType: "article", order: 2, estimatedMinutes: 30, concepts: ["performance"], quizRecommended: true },
              { title: "Capstone Project", contentType: "project", order: 3, estimatedMinutes: 75, concepts: ["capstone"], quizRecommended: false },
            ],
          },
        ],
      },
    ],
  }
}