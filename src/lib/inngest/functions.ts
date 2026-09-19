import { inngest } from "./client"
import { chatWithFallback } from "@/lib/nvidia"
import { createServerClient } from "@/lib/supabase/server"
import { getErrorMessage } from "@/lib/utils"
import type { LessonSpec, PhaseSpec, RoadmapSpec } from "@/lib/mockData"

type RoadmapJobData = {
  jobId: string
  goal: string
  level: string
  duration: string
  userId: string | null
}

type StepRunner = {
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T>
}

export const generateRoadmapFn = inngest.createFunction(
  { id: "generate-roadmap", triggers: [{ event: "roadmap/generate" }] },
  async ({ event, step }: { event: { data: RoadmapJobData }; step: StepRunner }) => {
    const { jobId, goal, level, duration, userId } = event.data
    console.log("[generate] Started job:", jobId, "goal:", goal)

    let jobCompleted = false

    try {
      // Mark job as processing (async/route already did this, but idempotent)
      await step.run("mark-processing", async () => {
        const supabase = createServerClient()
        await supabase.from("async_jobs").upsert({
          id: jobId,
          status: "processing",
          started_at: new Date().toISOString()
        }, { onConflict: "id" })
        console.log("[generate] Marked processing:", jobId)
      })

      const prompt = `Generate a learning roadmap for "${goal}" as JSON.

{
  "title": "Roadmap for ${goal}",
  "description": "A ${duration} roadmap for ${goal} at ${level} level",
  "phases": [
    {"title": "Phase 1: Foundations", "lessons": [
      {"title": "Lesson 1: Introduction to ${goal}", "objective": "Understand the basics of ${goal} and set up your learning environment."},
      {"title": "Lesson 2: Core Concepts", "objective": "Learn the fundamental concepts and terminology of ${goal}."},
      {"title": "Lesson 3: First Steps", "objective": "Complete your first hands-on exercise in ${goal}."},
      {"title": "Lesson 4: Basic Practice", "objective": "Practice the core skills needed for ${goal}."}
    ]},
    {"title": "Phase 2: Building Skills", "lessons": [
      {"title": "Lesson 5: Intermediate Concepts", "objective": "Deepen your understanding of ${goal} with intermediate topics."},
      {"title": "Lesson 6: Practical Project", "objective": "Build a small project applying ${goal} skills."},
      {"title": "Lesson 7: Best Practices", "objective": "Learn industry best practices for ${goal} development."},
      {"title": "Lesson 8: Review & Practice", "objective": "Consolidate learning with review exercises and practice problems."}
    ]}
  ]
}

Return ONLY valid JSON. No explanations, no markdown, no extra text.`

      const content = await step.run("nvidia-sync", async () => {
        console.log("[generate] Starting NIMs sync for:", jobId)
        try {
          const { content, modelUsed } = await chatWithFallback([
            { role: "system", content: "You are a JSON generator. Output ONLY valid JSON. No explanations, no markdown, no extra text." },
            { role: "user", content: prompt }
          ], true, 120000)
          console.log("[generate] NIMs sync completed, model:", modelUsed, "content length:", content.length)
          return content
        } catch (e) {
          console.error("[generate] NIMs sync failed:", getErrorMessage(e))
          console.log("[generate] AI failed, generating fallback roadmap")
          return JSON.stringify(generateFallbackRoadmap(goal, level, duration))
        }
      })

      // Clean content: strip thinking process, markdown fences, extract JSON
      let cleanedContent = content
      // Strip markdown code fences if present
      if (cleanedContent.startsWith("```")) {
        const ending = cleanedContent.indexOf("\n", 7)
        cleanedContent = ending !== -1 ? cleanedContent.substring(ending + 1) : cleanedContent.substring(7)
        cleanedContent = cleanedContent.replace(/```$/, "").trim()
      }
      // Strip "Here's a thinking process:" and similar prefixes
      const prefixes = ["Here's a thinking process:", "Here is a thinking process:", "Thinking Process:"]
      for (const p of prefixes) {
        if (cleanedContent.startsWith(p)) {
          cleanedContent = cleanedContent.substring(p.length).trim()
          break
        }
      }
      // Find the last '{' that starts a JSON object and extract from there
      const lastBrace = cleanedContent.lastIndexOf("{")
      if (lastBrace > 0) cleanedContent = cleanedContent.substring(lastBrace)
      // Final fallback: try to find any {...} pattern
      if (!cleanedContent.startsWith("{")) {
        const m = cleanedContent.match(/\{.*\}/)
        if (m) cleanedContent = m[0]
      }

      // Additional aggressive cleaning: remove any trailing text after the last '}'
      const lastClosingBrace = cleanedContent.lastIndexOf("}")
      if (lastClosingBrace > 0 && lastClosingBrace < cleanedContent.length - 1) {
        cleanedContent = cleanedContent.substring(0, lastClosingBrace + 1)
      }

      if (!cleanedContent || !cleanedContent.trim().startsWith("{")) {
        console.error("[generate] Empty or invalid content from NIMs:", cleanedContent?.slice(0, 200))
        await markJobFailed(jobId, "Empty or invalid content from NIMs")
        throw new Error("Empty or invalid content from NIMs")
      }

      let parsed: RoadmapSpec
      try {
        parsed = JSON.parse(cleanedContent) as RoadmapSpec
        console.log("[generate] Parsed roadmap JSON successfully")
      } catch (e) {
        console.error("[generate] Failed to parse roadmap JSON:", getErrorMessage(e))
        console.error("[generate] Cleaned content preview:", cleanedContent.slice(0, 500))
        // Fallback: generate a basic roadmap when AI fails
        console.log("[generate] AI failed, generating fallback roadmap")
        parsed = generateFallbackRoadmap(goal, level, duration)
        console.log("[generate] Generated fallback roadmap")
      }

      await step.run("save-to-supabase", async () => {
        const supabase = createServerClient()
        
        // Save roadmap
        const { data: roadmap, error: roadmapError } = await supabase
          .from("roadmaps")
          .insert({
            id: jobId,
            user_id: userId,
            title: parsed.title,
            description: parsed.description,
            goal: goal,
            lessons_total: parsed.phases?.reduce((a: number, p: PhaseSpec) => a + (p.lessons?.length || 0), 0) || 0
          })
          .select("id")
          .single()

        if (roadmapError) {
          console.error("[generate] Roadmap insert error:", roadmapError.message)
          throw roadmapError
        }
        console.log("[generate] Roadmap saved:", roadmap.id)

        // Save phases and lessons
        for (const [pi, phase] of (parsed.phases || []).entries()) {
          const { data: p, error: phaseError } = await supabase
            .from("phases")
            .insert({ roadmap_id: roadmap.id, idx: pi + 1, title: phase.title })
            .select("id")
            .single()

          if (phaseError) {
            console.error("[generate] Phase insert error:", phaseError.message)
            throw phaseError
          }

          for (const [li, lesson] of (phase.lessons || []).entries()) {
            await supabase.from("lessons").insert({
              roadmap_id: roadmap.id,
              phase_id: p.id,
              idx: li + 1,
              title: lesson.title,
              content_md: `## ${lesson.title}\n\n${lesson.objective || `Learn ${lesson.title} with AI guidance.`}`,
              example_code: `// Example for ${lesson.title}`,
              quiz: lesson.quiz || [{ q: `What is ${lesson.title}?`, options: ["Option A", "Option B", "Option C", "Option D"], correct: 0, explanation: "Review the lesson." }]
            })
          }
        }
        console.log("[generate] All phases/lessons saved")

        // Update job status to completed
        await supabase.from("async_jobs").upsert({
          id: jobId,
          status: "completed",
          completed_at: new Date().toISOString(),
          result: { roadmapId: roadmap.id }
        }, { onConflict: "id" })
        console.log("[generate] Job marked completed:", jobId)
      })

      jobCompleted = true
      console.log("[generate] Successfully completed job:", jobId)

      return { modelUsed: "async", jobId, roadmap: parsed }
    } catch (e) {
      if (!jobCompleted) {
        await markJobFailed(jobId, getErrorMessage(e))
      }
      console.error("[generate] Job failed:", jobId, getErrorMessage(e))
      throw e
    }
  }
)

async function markJobFailed(jobId: string, error: string) {
  try {
    const supabase = createServerClient()
    await supabase.from("async_jobs").upsert({
      id: jobId,
      status: "failed",
      error: error,
      completed_at: new Date().toISOString()
    }, { onConflict: "id" })
    console.log("[generate] Marked job failed:", jobId, error)
  } catch (e) {
    console.error("[generate] Failed to mark job failed:", e)
  }
}

function generateFallbackRoadmap(goal: string, level: string, duration: string): RoadmapSpec {
  const phase1Lessons: LessonSpec[] = [
    { title: `Lesson 1: Introduction to ${goal}`, objective: `Understand the basics of ${goal} and set up your learning environment.` },
    { title: `Lesson 2: Core Concepts`, objective: `Learn the fundamental concepts and terminology of ${goal}.` },
    { title: `Lesson 3: First Steps`, objective: `Complete your first hands-on exercise in ${goal}.` },
    { title: `Lesson 4: Basic Practice`, objective: `Practice the core skills needed for ${goal}.` }
  ]
  const phase2Lessons: LessonSpec[] = [
    { title: `Lesson 5: Intermediate Concepts`, objective: `Deepen your understanding of ${goal} with intermediate topics.` },
    { title: `Lesson 6: Practical Project`, objective: `Build a small project applying ${goal} skills.` },
    { title: `Lesson 7: Best Practices`, objective: `Learn industry best practices for ${goal} development.` },
    { title: `Lesson 8: Review & Practice`, objective: `Consolidate learning with review exercises and practice problems.` }
  ]
  return {
    title: `Roadmap for ${goal}`,
    description: `A ${duration} roadmap for ${goal} at ${level} level (fallback)`,
    phases: [
      { title: "Phase 1: Foundations", lessons: phase1Lessons.map((l, i) => ({ ...l, idx: i + 1 })) },
      { title: "Phase 2: Building Skills", lessons: phase2Lessons.map((l, i) => ({ ...l, idx: i + 1 })) }
    ]
  }
}