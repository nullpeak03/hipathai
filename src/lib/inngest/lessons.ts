import { inngest } from "./client"
import { NonRetriableError } from "inngest"
import { chatForFeature } from "@/lib/ai-router"
import { createServerClient } from "@/lib/supabase/server"
import { getErrorMessage } from "@/lib/utils"
import { buildLessonPrompt, splitLessonContent } from "@/lib/lesson-content"
import { isValidJobId } from "@/lib/generation-errors"
import { markJobFailed, type StepRunner } from "./functions"

type LessonJobData = { jobId: string; lessonId: string; userId: string }

type LessonBundle = {
  title: string
  objective: string
  level: string
  style: string
  goal: string
}

export const generateLessonFn = inngest.createFunction(
  { id: "generate-lesson", triggers: [{ event: "lesson/generate" }], retries: 1 },
  async ({ event, step }: { event: { data: LessonJobData }; step: StepRunner }) => {
    const { jobId, lessonId, userId } = event.data
    if (!isValidJobId(jobId)) {
      throw new NonRetriableError(`Invalid jobId (not a UUID): ${String(jobId).slice(0, 60)}`)
    }
    console.log("[lesson] Started job:", jobId, "lesson:", lessonId)

    let jobCompleted = false

    try {
      await step.run("mark-processing", async () => {
        const supabase = createServerClient()
        await supabase.from("async_jobs").upsert({
          id: jobId,
          status: "processing",
          started_at: new Date().toISOString(),
        }, { onConflict: "id" })
      })

      const bundle = await step.run("fetch-lesson", async (): Promise<LessonBundle | null> => {
        const supabase = createServerClient()
        const { data: lesson } = await supabase
          .from("lessons")
          .select("id,roadmap_id,title,content_md")
          .eq("id", lessonId)
          .single()
        if (!lesson) return null
        const { data: roadmap } = await supabase
          .from("roadmaps")
          .select("user_id,goal,level,style")
          .eq("id", (lesson as { roadmap_id: string }).roadmap_id)
          .single()
        const rm = roadmap as { user_id: string; goal: string | null; level: string | null; style: string | null } | null
        // Ownership recheck — userId came from the server session at enqueue
        if (!rm || rm.user_id !== userId) return null
        const l = lesson as { title: string; content_md: string | null }
        return {
          title: l.title,
          objective: (l.content_md ?? "").replace(/^##\s+.*\n/, "").trim().slice(0, 500),
          level: rm.level ?? "Beginner",
          style: rm.style ?? "Mixed",
          goal: rm.goal ?? "",
        }
      })

      if (!bundle) {
        await markJobFailed(jobId, "Lesson not found")
        throw new NonRetriableError("Lesson not found or not owned")
      }

      const prompt = buildLessonPrompt(bundle)
      const content = await step.run("nim-sync", async () => {
        // Bounded well under serverless execution limits (see roadmap phases).
        const r = await chatForFeature("lesson", [
          { role: "system", content: "You are a programming instructor writing a focused lesson. Follow the requested structure exactly. Plain text only." },
          { role: "user", content: prompt },
        ], { maxTokens: 4000, timeoutMs: 90000 })
        return r.content
      })

      const split = splitLessonContent(content)
      if (!split) {
        await markJobFailed(jobId, "Invalid lesson content from AI")
        throw new Error("Invalid lesson content from AI")
      }

      await step.run("save-to-supabase", async () => {
        const supabase = createServerClient()
        // Row update by id — idempotent, safe across step retries
        const { error } = await supabase
          .from("lessons")
          .update({ content_md: split.contentMd, example_code: split.exampleCode })
          .eq("id", lessonId)
        if (error) throw error
        await supabase.from("async_jobs").upsert({
          id: jobId,
          status: "completed",
          completed_at: new Date().toISOString(),
          result: { lessonId },
        }, { onConflict: "id" })
        console.log("[lesson] Job marked completed:", jobId)
      })

      jobCompleted = true
      console.log("[lesson] Successfully completed job:", jobId)
      return { jobId, lessonId }
    } catch (e) {
      if (!jobCompleted) {
        await markJobFailed(jobId, getErrorMessage(e))
      }
      console.error("[lesson] Job failed:", jobId, getErrorMessage(e))
      throw e
    }
  }
)
