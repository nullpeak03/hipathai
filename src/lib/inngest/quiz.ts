import { inngest } from "./client"
import { NonRetriableError } from "inngest"
import { chatForFeature } from "@/lib/ai-router"
import { createServerClient } from "@/lib/supabase/server"
import { getErrorMessage } from "@/lib/utils"
import { buildQuizPrompt, normalizeQuizQuestions, type QuizMode, quizQualityScore, QUIZ_MIN_BANK } from "@/lib/quiz"
import type { QuizQuestion } from "@/lib/mockData"
import { flattenLessonContent, isLessonContent } from "@/lib/lesson-content-blocks"
import { classifyJobError, isValidJobId } from "@/lib/generation-errors"
import { markJobFailed, type StepRunner } from "./functions"
import { sendAdminAlert } from "@/lib/alerts"

type QuizJobData = { jobId: string; lessonId: string; userId: string; mode: QuizMode }

export const generateQuizFn = inngest.createFunction(
  {
    id: "generate-quiz",
    triggers: [{ event: "quiz/generate" }],
    retries: 2,
    onFailure: async ({ event }: { event: { data?: { event?: { data?: { jobId?: unknown } } } } }) => {
      const jobId = event?.data?.event?.data?.jobId
      if (typeof jobId === "string" && isValidJobId(jobId)) {
        await markJobFailed(jobId, "Quiz generation kept timing out or hit AI limits. Please try again in a few minutes.")
        await sendAdminAlert("generate-quiz", "Quiz job exhausted retries", `jobId: ${jobId}`)
      }
    },
  },
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
        throw new NonRetriableError("Lesson not found or not owned")
      }

      const safeParse = (raw: string): unknown => {
        try {
          return (JSON.parse(raw) as { questions?: unknown }).questions
        } catch {
          return undefined
        }
      }
      // Validate INSIDE the step and throw there: a throw outside any step
      // would replay memoized (identical) content on function retry until
      // retries exhaust. A throw inside the step re-executes that step with
      // a fresh model call — transient shape errors self-heal.
      const validateBank = (parsed: unknown, raw: string, label: string): QuizQuestion[] => {
        const questions = normalizeQuizQuestions(parsed, (i, reason) =>
          console.warn(`[quiz] bank defect ${label} q${i}: ${reason}; raw head: ${raw.slice(0, 300)}`)
        )
        if (!questions) throw new Error("Invalid quiz JSON from model")
        return questions
      }
      const quizSystem = "You are a JSON generator. Output ONLY valid JSON. No explanations, no markdown, no extra text."
      // Single call for all modes — Lightning handles 10Q in ~15s, well within 60s step budget.
      const questions: QuizQuestion[] = await step.run("generate-quiz", async () => {
        const r = await chatForFeature("quiz", [
          { role: "system", content: quizSystem },
          { role: "user", content: buildQuizPrompt(bundle.title, bundle.text, mode, { count: 8 }) },
        ], { jsonMode: true, maxTokens: 2500, timeoutMs: 60000, retries: 1, deadlineMs: 90000 })
        const qs = validateBank(safeParse(r.content), r.content, mode)
        if (qs.length < QUIZ_MIN_BANK) throw new Error(`Quiz bank too small: ${qs.length} questions`)
        // Quality gate: regenerate once if score < 60
        const quality = quizQualityScore(qs)
        console.log(`[quiz] Generated bank quality: ${quality}/100`)
        if (quality < 60) {
          console.warn(`[quiz] Quality ${quality} < 60, regenerating once`)
          const r2 = await chatForFeature("quiz", [
            { role: "system", content: quizSystem + " Previous output scored low on quality. Ensure: 4 distinct options, two-part explanations, varied correct positions, code questions where appropriate, difficulty tags, 8-10 unique questions covering all lesson concepts." },
            { role: "user", content: buildQuizPrompt(bundle.title, bundle.text, mode, { count: 8 }) },
          ], { jsonMode: true, maxTokens: 2500, timeoutMs: 60000, retries: 0, deadlineMs: 90000 })
          const qs2 = validateBank(safeParse(r2.content), r2.content, mode + "-regen")
          if (quizQualityScore(qs2) > quality) {
            console.log(`[quiz] Regenerated quality: ${quizQualityScore(qs2)}`)
            return qs2
          }
        }
        return qs
      })
      console.log(`[quiz] ${mode} bank ready: ${questions.length} questions (quality: ${quizQualityScore(questions)})`)

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
        const { retriable, friendly } = classifyJobError(e)
        if (retriable) {
          try {
            const supabase = createServerClient()
            await supabase.from("async_jobs").upsert({
              id: jobId,
              status: "processing",
              error: friendly,
            }, { onConflict: "id" })
          } catch (noteErr) {
            console.warn("[quiz] Failed to note retriable error:", getErrorMessage(noteErr))
          }
          console.warn("[quiz] Job hit transient error, leaving for retry:", jobId, friendly)
        } else {
          await markJobFailed(jobId, friendly)
          console.error("[quiz] Job failed:", jobId, friendly)
        }
      }
      throw e
    }
  }
)
