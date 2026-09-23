import { inngest } from "./client"
import { NonRetriableError } from "inngest"
import { chatForFeature } from "@/lib/ai-router"
import { createServerClient } from "@/lib/supabase/server"
import { getErrorMessage } from "@/lib/utils"
import { buildLessonJsonPrompt, splitLessonContent } from "@/lib/lesson-content"
import { parseLessonContent, flattenLessonContent, lessonQualityScore, type LessonContent } from "@/lib/lesson-content-blocks"
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

      const prompt = buildLessonJsonPrompt(bundle)
      const content = await step.run("nim-sync", async () => {
        // Bounded well under serverless execution limits (see roadmap phases).
        const r = await chatForFeature("lesson", [
          { role: "system", content: "You are a programming instructor writing a focused lesson. Follow the requested JSON contract exactly." },
          { role: "user", content: prompt },
        ], { jsonMode: true, maxTokens: 5000, timeoutMs: 90000 })
        return r.content
      })

      // Parse chain: structured JSON first, legacy marker-split salvage
      // second, fail the job only when nothing usable exists.
      // Quality guard: score <70 triggers one stricter regeneration.
      let doc: LessonContent | null = null
      let rawContent = content
      try {
        doc = parseLessonContent(rawContent)
      } catch {
        doc = null
      }
      if (doc && lessonQualityScore(doc) < 70) {
        console.log(`[lesson] Quality ${lessonQualityScore(doc)} <70, regenerating once with stricter prompt`)
        try {
          const retryPrompt = buildLessonJsonPrompt(bundle) + " CRITICAL: Must include at least one code block, one exercise/check, objectives, and recap. No fluff."
          const r2 = await chatForFeature("lesson", [
            { role: "system", content: "You are a programming instructor writing a focused lesson. Follow the requested JSON contract exactly. Quality matters." },
            { role: "user", content: retryPrompt },
          ], { jsonMode: true, maxTokens: 5000, timeoutMs: 90000 })
          const doc2 = parseLessonContent(r2.content)
          if (doc2 && lessonQualityScore(doc2) >= lessonQualityScore(doc)) {
            doc = doc2
            rawContent = r2.content
            console.log(`[lesson] Regenerated quality ${lessonQualityScore(doc2)}`)
          }
        } catch (e2) {
          console.warn("[lesson] Regeneration failed, keeping original:", getErrorMessage(e2 as Error))
        }
      }
      let contentMd: string
      let exampleCode: string
      if (doc) {
        contentMd = flattenLessonContent(doc)
        const codeBlock = doc.sections.find((b) => b.type === "code")
        exampleCode = codeBlock ? codeBlock.code : ""
        console.log(`[lesson] Structured content ready: ${doc.sections.length} blocks, quality ${lessonQualityScore(doc)}`)
      } else {
        const split = splitLessonContent(rawContent)
        if (!split) {
          await markJobFailed(jobId, "Invalid lesson content from AI")
          throw new Error("Invalid lesson content from AI")
        }
        console.log("[lesson] Salvaged legacy prose content")
        doc = null
        contentMd = split.contentMd
        exampleCode = split.exampleCode
      }

      await step.run("save-to-supabase", async () => {
        const supabase = createServerClient()
        // Row update by id — idempotent, safe across step retries
        const { error } = await supabase
          .from("lessons")
          .update({ content_md: contentMd, example_code: exampleCode, content_json: doc })
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
