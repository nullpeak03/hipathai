import { inngest } from "./client"
import { NonRetriableError } from "inngest"
import { chatForFeature } from "@/lib/ai-router"
import { createServerClient } from "@/lib/supabase/server"
import { getErrorMessage } from "@/lib/utils"
import { buildQuizPrompt, normalizeQuizQuestions } from "@/lib/quiz"
import { flattenLessonContent, isLessonContent } from "@/lib/lesson-content-blocks"
import { isValidJobId } from "@/lib/generation-errors"
import { markJobFailed, type StepRunner } from "./functions"

type QuizJobData = { jobId: string; lessonId: string; userId: string; mode: string }

export const generateQuizFn = inngest.createFunction(
  { id: "generate-quiz", triggers: [{ event: "quiz/generate" }], retries: 1 },
  async ({ event, step }: { event: { data: QuizJobData }; step: StepRunner }) => {
    const { jobId, lessonId, userId, mode } = event.data
    if (!isValidJobId(jobId)) {
      throw new NonRetriableError(`Invalid jobId (not a UUID): ${String(jobId).slice(0, 60)}`)
    }
    console.log("[quiz] Started job:", jobId, "lesson:", lessonId, "mode:", mode)

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

      const bundle = await step.run("fetch-lesson", async () => {
        const supabase = createServerClient()
        const { data: lesson } = await supabase
          .from("lessons")
          .select("id,roadmap_id,title,content_md,content_json")
          .eq("id", lessonId)
          .single()
        if (!lesson) return null
        const { data: roadmap } = await supabase
          .from("roadmaps")
          .select("user_id")
          .eq("id", (lesson as { roadmap_id: string }).roadmap_id)
          .single()
        const rm = roadmap as { user_id: string } | null
        if (!rm || rm.user_id !== userId) return null
        const l = lesson as { title: string; content_md: string | null; content_json: unknown }
        const text = isLessonContent(l.content_json) ? flattenLessonContent(l.content_json) : (l.content_md ?? "")
        return { title: l.title, text }
      })

      if (!bundle) {
        await markJobFailed(jobId, "Lesson not found")
        throw new NonRetriableError("Lesson not found or not owned")
      }

      const content = await step.run("generate-quiz", async () => {
        const r = await chatForFeature("quiz", [
          { role: "system", content: "You are a JSON generator. Output ONLY valid JSON. No explanations, no markdown, no extra text." },
          { role: "user", content: buildQuizPrompt(bundle.title, bundle.text, mode as any) },
        ], { jsonMode: true, maxTokens: mode === "standard" ? 3500 : 2000, timeoutMs: 90000 })
        return r.content
      })

      const parsed = JSON.parse(content) as { questions?: unknown }
      const questions = normalizeQuizQuestions(parsed.questions)
      if (!questions) {
        await markJobFailed(jobId, "Invalid quiz JSON from model")
        throw new Error("Invalid quiz JSON from model")
      }

      await step.run("save-to-supabase", async () => {
        const supabase = createServerClient()
        await supabase.from("lessons").update({ quiz_bank: questions, quiz: questions }).eq("id", lessonId)
        await supabase.from("async_jobs").upsert({
          id: jobId,
          status: "completed",
          completed_at: new Date().toISOString(),
          result: { lessonId, quizCount: questions.length },
        }, { onConflict: "id" })
        console.log("[quiz] Job marked completed:", jobId, "questions:", questions.length)
      })

      jobCompleted = true
      console.log("[quiz] Successfully completed job:", jobId)
      return { jobId, lessonId, quizCount: questions.length }
    } catch (e) {
      if (!jobCompleted) {
        await markJobFailed(jobId, getErrorMessage(e))
      }
      console.error("[quiz] Job failed:", jobId, getErrorMessage(e))
      throw e
    }
  }
)
