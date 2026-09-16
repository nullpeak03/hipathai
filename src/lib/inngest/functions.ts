import { inngest } from "./client"
import { streamWithFallback } from "@/lib/nvidia"
import { createServerClient } from "@/lib/supabase/server"

export const generateRoadmapFn = inngest.createFunction(
  { id: "generate-roadmap", trigger: { event: "roadmap/generate" } } as any,
  async ({ event, step }: any) => {
    const { jobId, goal, level, time, duration, why, style, timeMins, durationDays, userId } = event.data
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

      const prompt = `Generate a CS roadmap for goal "${goal}". Level: ${level}, Time: ${time}/day, Duration: ${duration}. Create EXACTLY 5 phases with ~40 lessons total. Each lesson title must be UNIQUE and goal-specific. Each objective must be a concise sentence (8-12 words). Return ONLY valid JSON: {title, description, phases:[{title, lessons:[{title, objective}]}]} No explanatory text, no markdown fences, no "Here's a thinking process:" prefix.`

      const content = await step.run("nvidia-stream-async", async () => {
        console.log("[generate] Starting NIMs stream for:", jobId)
        let fullContent = ""
        for await (const chunk of streamWithFallback([{ role: "user", content: prompt }], true)) {
          if (chunk.startsWith("__MODEL__:")) continue
          fullContent += chunk
        }
        console.log("[generate] NIMs stream completed, content length:", fullContent.length)
        return fullContent
      })

      if (!content || !content.trim().startsWith("{")) {
        console.error("[generate] Empty or invalid content from NIMs:", content?.slice(0, 200))
        await markJobFailed(jobId, "Empty or invalid content from NIMs")
        throw new Error("Empty or invalid content from NIMs")
      }

      let parsed
      try {
        parsed = JSON.parse(content)
        console.log("[generate] Parsed roadmap JSON successfully")
      } catch {
        const lastBrace = content.lastIndexOf("{")
        if (lastBrace > 0) {
          parsed = JSON.parse(content.substring(lastBrace))
          console.log("[generate] Recovered JSON from last brace")
        } else {
          console.error("[generate] Failed to parse roadmap JSON")
          await markJobFailed(jobId, "Failed to parse roadmap JSON")
          throw new Error("Failed to parse roadmap JSON")
        }
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
            lessons_total: parsed.phases?.reduce((a: number, p: any) => a + (p.lessons?.length || 0), 0) || 0
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
    } catch (e: any) {
      if (!jobCompleted) {
        await markJobFailed(jobId, e.message)
      }
      console.error("[generate] Job failed:", jobId, e.message)
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