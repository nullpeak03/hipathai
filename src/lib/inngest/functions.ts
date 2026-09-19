import { inngest } from "./client"
import { NonRetriableError } from "inngest"
import { chatWithGemini } from "@/lib/gemini"
import { createServerClient } from "@/lib/supabase/server"
import { getErrorMessage } from "@/lib/utils"
import { buildRoadmapPrompt, ROADMAP_JSON_SYSTEM } from "@/lib/roadmap-prompt"
import { normalizeRoadmapJson } from "@/lib/roadmap-normalize"
import { isValidJobId } from "@/lib/generation-errors"
import type { LessonSpec, PhaseSpec, RoadmapSpec } from "@/lib/mockData"

type RoadmapJobData = {
  jobId: string
  goal: string
  level: string
  time: string
  duration: string
  why: string
  style: string
  userId: string | null
}

type StepRunner = {
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T>
}

export const generateRoadmapFn = inngest.createFunction(
  { id: "generate-roadmap", triggers: [{ event: "roadmap/generate" }], retries: 2 },
  async ({ event, step }: { event: { data: RoadmapJobData }; step: StepRunner }) => {
    const { jobId, goal, level, time, duration, why, style, userId } = event.data
    // jobId doubles as roadmaps.id (uuid) — fail fast without retries on garbage
    if (!isValidJobId(jobId)) {
      throw new NonRetriableError(`Invalid jobId (not a UUID): ${String(jobId).slice(0, 60)}`)
    }
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

      const prompt = buildRoadmapPrompt({ goal, level, time, duration })

      const content = await step.run("gemini-sync", async () => {
        console.log("[generate] Starting Gemini sync for:", jobId)
        try {
          const { content, modelUsed } = await chatWithGemini([
            { role: "system", content: ROADMAP_JSON_SYSTEM },
            { role: "user", content: prompt }
          ], true, 240000, 8000)
          console.log("[generate] Gemini sync completed, model:", modelUsed, "content length:", content.length)
          return content
        } catch (e) {
          console.error("[generate] Gemini sync failed:", getErrorMessage(e))
          console.log("[generate] AI failed, generating fallback roadmap")
          return JSON.stringify(generateFallbackRoadmap(goal, level, duration))
        }
      })

      // chatWithGemini already extracted + validated the JSON object in
      // jsonMode — parse it directly. (A previous version re-cleaned here
      // with lastIndexOf("{") and butchered valid roadmaps into fragments.)
      if (!content || !content.trim().startsWith("{")) {
        console.error("[generate] Empty or invalid content from Gemini:", content?.slice(0, 200))
        await markJobFailed(jobId, "Empty or invalid content from Gemini")
        throw new Error("Empty or invalid content from Gemini")
      }

      let parsed: RoadmapSpec
      try {
        const rawJson = JSON.parse(content) as unknown
        const normalized = normalizeRoadmapJson(rawJson, { goal, level, duration })
        if (!normalized) throw new Error("Unusable roadmap JSON")
        parsed = normalized
        console.log("[generate] Parsed roadmap JSON successfully")
      } catch (e) {
        console.error("[generate] Failed to parse roadmap JSON:", getErrorMessage(e))
        console.error("[generate] Content preview:", content.slice(0, 500))
        // Fallback: generate a basic roadmap when AI fails
        console.log("[generate] AI failed, generating fallback roadmap")
        parsed = generateFallbackRoadmap(goal, level, duration)
        console.log("[generate] Generated fallback roadmap")
      }

      await step.run("save-to-supabase", async () => {
        const supabase = createServerClient()
        const specs = parsed.phases || []

        // Retry safety: a retried run must not collide with its own partial
        // save (roadmap delete cascades phases/lessons).
        await supabase.from("roadmaps").delete().eq("id", jobId)

        // 1. Roadmap (id = jobId so the status endpoint can find it)
        const { error: roadmapError } = await supabase
          .from("roadmaps")
          .insert({
            id: jobId,
            user_id: userId,
            title: parsed.title,
            description: parsed.description,
            goal: goal,
            level: level,
            time_per_day: time,
            duration: duration,
            why: why,
            style: style,
            lessons_total: specs.reduce((a: number, p: PhaseSpec) => a + (p.lessons?.length || 0), 0)
          })

        if (roadmapError) {
          console.error("[generate] Roadmap insert error:", roadmapError.message)
          throw roadmapError
        }
        console.log("[generate] Roadmap saved:", jobId)

        // 2. Phases — one bulk insert with pre-generated UUIDs
        const phaseRows = specs.map((phase, pi) => ({
          id: crypto.randomUUID(),
          roadmap_id: jobId,
          idx: pi + 1,
          title: phase.title
        }))
        const { error: phaseError } = await supabase.from("phases").insert(phaseRows)
        if (phaseError) {
          console.error("[generate] Phase insert error:", phaseError.message)
          throw phaseError
        }

        // 3. Lessons — one bulk insert referencing the phase UUIDs above
        const lessonRows = specs.flatMap((phase, pi) =>
          (phase.lessons || []).map((lesson, li) => ({
            id: crypto.randomUUID(),
            roadmap_id: jobId,
            phase_id: phaseRows[pi].id,
            idx: li + 1,
            title: lesson.title,
            content_md: `## ${lesson.title}\n\n${lesson.objective || `Learn ${lesson.title} with AI guidance.`}`,
            example_code: `// Example for ${lesson.title}`,
            quiz: lesson.quiz || [{ q: `What is ${lesson.title}?`, options: ["Option A", "Option B", "Option C", "Option D"], correct: 0, explanation: "Review the lesson." }]
          }))
        )
        if (lessonRows.length > 0) {
          const { error: lessonError } = await supabase.from("lessons").insert(lessonRows)
          if (lessonError) {
            console.error("[generate] Lesson insert error:", lessonError.message)
            throw lessonError
          }
        }
        console.log("[generate] All phases/lessons saved")

        // Update job status to completed
        await supabase.from("async_jobs").upsert({
          id: jobId,
          status: "completed",
          completed_at: new Date().toISOString(),
          result: { roadmapId: jobId }
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