import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { auth } from "@clerk/nextjs/server"

interface AdaptRoadmapRequest {
  roadmapId: string
  trigger: "manual" | "auto" | "weakness_threshold"
  weakConcepts?: string[]
}

interface AdaptedPhase {
  title: string
  description: string
  order: number
  estimated_hours: number
  modules: AdaptedModule[]
}

interface AdaptedModule {
  title: string
  description: string
  order: number
  estimated_minutes: number
  lessons: AdaptedLesson[]
}

interface AdaptedLesson {
  title: string
  content_type: "video" | "article" | "interactive" | "mixed"
  content_data: Record<string, any>
  order: number
  estimated_minutes: number
}

async function generateAdaptedRoadmap(
  currentRoadmap: any,
  weakConcepts: string[],
  completedLessons: any[],
  userProfile: any
): Promise<AdaptedPhase[]> {
  const nimApiKey = process.env.NVIDIA_NIM_API_KEY
  const nimBaseUrl = process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1"
  
  if (!nimApiKey) {
    return generateFallbackAdaptation(currentRoadmap, weakConcepts, completedLessons)
  }

  const completedTitles = completedLessons.map(l => l.title)
  const remainingPhases = currentRoadmap.roadmap_phases
    .filter((p: any) => p.order >= (currentRoadmap.current_phase || 1))
    .map((p: any) => ({
      title: p.title,
      modules: p.roadmap_modules?.map((m: any) => ({
        title: m.title,
        lessons: m.lessons?.map((l: any) => l.title) || [],
      })) || [],
    }))

  const systemPrompt = `You are an expert learning designer creating an adaptive roadmap update.
The user has shown weakness in these concepts: ${weakConcepts.join(", ")}.
They have completed: ${completedTitles.join(", ")}.
Remaining planned content: ${JSON.stringify(remainingPhases)}.

Generate ONLY the REMAINING phases (from current phase onwards) with additional reinforcement lessons for weak concepts.
Do NOT regenerate already completed content.
Output as JSON array of phases with modules and lessons.`

  const userPrompt = `Current phase: ${currentRoadmap.current_phase || 1}
Weak concepts needing reinforcement: ${weakConcepts.join(", ")}
User profile: ${JSON.stringify(userProfile)}
Remaining roadmap structure: ${JSON.stringify(remainingPhases)}

Generate adapted remaining phases with reinforcement lessons for weak concepts integrated appropriately.`

  try {
    const response = await fetch(`${nimBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${nimApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta/llama-3.1-70b-instruct",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      throw new Error(`NIM API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content
    const parsed = JSON.parse(content)
    return parsed.phases || parsed
  } catch (error) {
    console.error("NIM adaptation error:", error)
    return generateFallbackAdaptation(currentRoadmap, weakConcepts, completedLessons)
  }
}

function generateFallbackAdaptation(
  currentRoadmap: any,
  weakConcepts: string[],
  completedLessons: any[]
): AdaptedPhase[] {
  const currentPhase = currentRoadmap.current_phase || 1
  const remainingPhases = currentRoadmap.roadmap_phases
    .filter((p: any) => p.order >= currentPhase)
    .slice(0, 3) // Limit to next 3 phases

  // Add reinforcement phase at the beginning if there are weak concepts
  const phases: AdaptedPhase[] = []
  
  if (weakConcepts.length > 0) {
    phases.push({
      title: "Reinforcement & Review",
      description: `Focused review of weak concepts: ${weakConcepts.join(", ")}`,
      order: currentPhase,
      estimated_hours: 2,
      modules: [
        {
          title: "Concept Reinforcement",
          description: "Targeted practice for identified weak areas",
          order: 1,
          estimated_minutes: 60,
          lessons: weakConcepts.slice(0, 3).map((concept, i) => ({
            title: `Review: ${concept}`,
            content_type: "interactive" as const,
            content_data: {
              type: "review",
              concept,
              exercises: [
                `Practice problem for ${concept}`,
                `Explanation of common mistakes in ${concept}`,
                `Real-world application of ${concept}`,
              ],
            },
            order: i + 1,
            estimated_minutes: 20,
          })),
        },
        {
          title: "Mixed Practice",
          description: "Integrated exercises combining weak concepts",
          order: 2,
          estimated_minutes: 60,
          lessons: [
            {
              title: "Integrated Practice Session",
              content_type: "interactive" as const,
              content_data: {
                type: "mixed_practice",
                concepts: weakConcepts.slice(0, 5),
              },
              order: 1,
              estimated_minutes: 60,
            },
          ],
        },
      ],
    })
  }

  // Add remaining original phases with adjusted order
  remainingPhases.forEach((phase: any, idx: number) => {
    phases.push({
      title: phase.title,
      description: phase.description,
      order: currentPhase + phases.length,
      estimated_hours: phase.estimated_hours,
      modules: phase.roadmap_modules?.map((module: any, mIdx: number) => ({
        title: module.title,
        description: module.description,
        order: mIdx + 1,
        estimated_minutes: module.estimated_minutes,
        lessons: module.lessons?.map((lesson: any, lIdx: number) => ({
          title: lesson.title,
          content_type: lesson.content_type,
          content_data: lesson.content_data,
          order: lIdx + 1,
          estimated_minutes: lesson.estimated_minutes,
        })) || [],
      })) || [],
    })
  })

  return phases
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { roadmapId, trigger, weakConcepts }: AdaptRoadmapRequest = body

    if (!roadmapId) {
      return NextResponse.json({ error: "Roadmap ID required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("clerk_id", userId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    // Get current roadmap with full structure
    const { data: roadmap, error: roadmapError } = await supabase
      .from("roadmaps")
      .select(`
        id,
        title,
        topic,
        description,
        status,
        current_phase,
        version,
        user_id,
        roadmap_phases (
          id,
          title,
          description,
          order,
          estimated_hours,
          roadmap_modules (
            id,
            title,
            description,
            order,
            estimated_minutes,
            lessons (
              id,
              title,
              content_type,
              content_data,
              order,
              estimated_minutes,
              completed
            )
          )
        )
      `)
      .eq("id", roadmapId)
      .eq("user_id", profile.id)
      .single()

    if (roadmapError || !roadmap) {
      return NextResponse.json({ error: "Roadmap not found" }, { status: 404 })
    }

    // Get completed lessons
    const completedLessons = roadmap.roadmap_phases
      .flatMap((p: any) => p.roadmap_modules?.flatMap((m: any) => m.lessons || []) || [])
      .filter((l: any) => l.completed)

    // Determine weak concepts if not provided
    let conceptsToReinforce = weakConcepts || []
    if (conceptsToReinforce.length === 0) {
      const { data: userConcepts } = await supabase
        .from("user_concepts")
        .select("concept, mastery_level")
        .eq("user_id", profile.id)
        .lt("mastery_level", 60)
        .order("mastery_level", { ascending: true })
        .limit(10)
      
      conceptsToReinforce = userConcepts?.map(c => c.concept) || []
    }

    // Generate adapted roadmap
    const adaptedPhases = await generateAdaptedRoadmap(
      roadmap,
      conceptsToReinforce,
      completedLessons,
      profile
    )

    // Create new roadmap version
    const newVersion = roadmap.version + 1
    const { data: newRoadmap, error: createError } = await supabase
      .from("roadmaps")
      .insert({
        user_id: profile.id,
        title: roadmap.title,
        topic: roadmap.topic,
        description: roadmap.description,
        status: "active",
        current_phase: roadmap.current_phase,
        version: newVersion,
        parent_roadmap_id: roadmap.id,
      })
      .select("id")
      .single()

    if (createError) throw createError

    // Insert new phases
    for (const phase of adaptedPhases) {
      const { data: newPhase } = await supabase
        .from("roadmap_phases")
        .insert({
          roadmap_id: newRoadmap.id,
          title: phase.title,
          description: phase.description,
          order: phase.order,
          estimated_hours: phase.estimated_hours,
        })
        .select("id")
        .single()

      if (!newPhase) continue

      for (const module of phase.modules) {
        const { data: newModule } = await supabase
          .from("roadmap_modules")
          .insert({
            phase_id: newPhase.id,
            title: module.title,
            description: module.description,
            order: module.order,
            estimated_minutes: module.estimated_minutes,
          })
          .select("id")
          .single()

        if (!newModule) continue

        for (const lesson of module.lessons) {
          await supabase
            .from("lessons")
            .insert({
              module_id: newModule.id,
              title: lesson.title,
              content_type: lesson.content_type,
              content_data: lesson.content_data,
              order: lesson.order,
              estimated_minutes: lesson.estimated_minutes,
            })
        }
      }
    }

    // Mark old roadmap as archived
    await supabase
      .from("roadmaps")
      .update({ status: "archived" })
      .eq("id", roadmapId)

    // Record adaptation event
    await supabase
      .from("study_sessions")
      .insert({
        user_id: profile.id,
        roadmap_id: newRoadmap.id,
        duration: 0,
        activity_type: "adaptation",
      })

    return NextResponse.json({
      success: true,
      newRoadmapId: newRoadmap.id,
      newVersion,
      adaptedPhases: adaptedPhases.length,
      reinforcedConcepts: conceptsToReinforce,
      trigger,
    })
  } catch (error) {
    console.error("Roadmap adaptation error:", error)
    return NextResponse.json(
      { error: "Failed to adapt roadmap" },
      { status: 500 }
    )
  }
}