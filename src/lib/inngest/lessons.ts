import { inngest } from "./client"
import { NonRetriableError } from "inngest"
import { chatForFeature } from "@/lib/ai-router"
import { createServerClient } from "@/lib/supabase/server"
import { getErrorMessage } from "@/lib/utils"
import { buildLessonPartPrompt, splitLessonContent } from "@/lib/lesson-content"
import { parseLessonContent, flattenLessonContent, lessonQualityScore, type LessonContent } from "@/lib/lesson-content-blocks"
import { classifyJobError, isValidJobId } from "@/lib/generation-errors"
import { markJobFailed, type StepRunner } from "./functions"
import { sendAdminAlert } from "@/lib/alerts"

type LessonJobData = { jobId: string; lessonId: string; userId: string }

type LessonBundle = {
  title: string
  objective: string
  level: string
  style: string
  goal: string
}

export const generateLessonFn = inngest.createFunction(
  {
    id: "generate-lesson",
    triggers: [{ event: "lesson/generate" }],
    retries: 2,
    onFailure: async ({ event }: { event: { data?: { event?: { data?: { jobId?: unknown } } } } }) => {
      const jobId = event?.data?.event?.data?.jobId
      if (typeof jobId === "string" && isValidJobId(jobId)) {
        await markJobFailed(jobId, "Lesson generation hit repeated AI rate limits. Please try again in a few minutes.")
        await sendAdminAlert("generate-lesson", "Lesson job exhausted retries", `jobId: ${jobId}`)
      }
    },
  },
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
        throw new NonRetriableError("Lesson not found or not owned")
      }

      // Two bounded part-steps: a full Extended lesson (~8000 tokens) blows
      // the ~50s per-step serverless budget. Each part holds ONE 25s call
      // (worst ~50s with fallback); the section arrays merge below.
      type LessonPart = { doc: LessonContent | null; raw: string }
      const partA = await step.run("generate-lesson-part-a", async (): Promise<LessonPart> => {
        const r = await chatForFeature("lesson", [
          { role: "system", content: "You are a programming instructor writing a focused lesson. Follow the requested JSON contract exactly." },
          { role: "user", content: buildLessonPartPrompt(bundle, "foundation") },
        ], { jsonMode: true, maxTokens: 3500, timeoutMs: 25000, retries: 0 })
        let doc: LessonContent | null = null
        try {
          doc = parseLessonContent(r.content)
        } catch {
          doc = null
        }
        return { doc, raw: r.content }
      })
      // Part-one headings keep the stateless part-two call continuous
      // instead of repeating topics (derived from memoized part A).
      const headingsA = (partA.doc?.sections ?? [])
        .filter((s) => s.type === "heading")
        .map((s) => (s as { text: string }).text)
        .slice(0, 12)
      const partB = await step.run("generate-lesson-part-b", async (): Promise<LessonPart> => {
        const r = await chatForFeature("lesson", [
          { role: "system", content: "You are a programming instructor writing a focused lesson. Follow the requested JSON contract exactly." },
          { role: "user", content: buildLessonPartPrompt(bundle, "practice", headingsA) },
        ], { jsonMode: true, maxTokens: 2500, timeoutMs: 25000, retries: 0 })
        let doc: LessonContent | null = null
        try {
          doc = parseLessonContent(r.content)
        } catch {
          doc = null
        }
        return { doc, raw: r.content }
      })

      // Parse chain: structured JSON first, legacy marker-split salvage
      // second, fail the job only when nothing usable exists.
      // Quality guard: score <70 regenerates the weaker half once.
      const mergeParts = (a: LessonContent | null, b: LessonContent | null): LessonContent | null => {
        const sections = [...(a?.sections ?? []), ...(b?.sections ?? [])]
        return sections.length > 0 ? { sections } : null
      }
      let doc: LessonContent | null = mergeParts(partA.doc, partB.doc)
      let rawContent = `${partA.raw}\n${partB.raw}`
      const scoreOf = (d: LessonContent | null) => (d ? lessonQualityScore(d) : 0)
      if (doc && lessonQualityScore(doc) < 70) {
        const weakSide = scoreOf(partA.doc) <= scoreOf(partB.doc) ? "foundation" : "practice"
        console.log(`[lesson] Quality ${lessonQualityScore(doc)} <70, regenerating weaker half (${weakSide}) once`)
        const regen = await step.run("regenerate-lesson-weak-part", async (): Promise<LessonPart> => {
          try {
            const strictPrompt = buildLessonPartPrompt(bundle, weakSide, headingsA) +
              (weakSide === "foundation"
                ? " CRITICAL: Must include at least two code blocks (basic then applied), objectives, and a use case. No fluff."
                : " CRITICAL: Must include a PRACTICE SET of 3-4 exercises with solutions, plus recap. No fluff.")
            const r2 = await chatForFeature("lesson", [
              { role: "system", content: "You are a programming instructor writing a focused lesson. Follow the requested JSON contract exactly. Quality matters." },
              { role: "user", content: strictPrompt },
            ], { jsonMode: true, maxTokens: weakSide === "foundation" ? 3500 : 2500, timeoutMs: 25000, retries: 0 })
            let redone: LessonContent | null = null
            try {
              redone = parseLessonContent(r2.content)
            } catch {
              redone = null
            }
            return { doc: redone, raw: r2.content }
          } catch (e2) {
            console.warn("[lesson] Regeneration failed, keeping original:", getErrorMessage(e2 as Error))
            return { doc: null, raw: "" }
          }
        })
        if (regen.doc) {
          const merged = weakSide === "foundation"
            ? mergeParts(regen.doc, partB.doc)
            : mergeParts(partA.doc, regen.doc)
          if (merged && lessonQualityScore(merged) >= lessonQualityScore(doc)) {
            doc = merged
            rawContent = regen.raw
            console.log(`[lesson] Regenerated quality ${lessonQualityScore(merged)}`)
          }
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
          // Retriable: a malformed model reply often self-heals on regeneration.
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
            console.warn("[lesson] Failed to note retriable error:", getErrorMessage(noteErr))
          }
          console.warn("[lesson] Job hit transient error, leaving for retry:", jobId, friendly)
        } else {
          await markJobFailed(jobId, friendly)
          console.error("[lesson] Job failed:", jobId, friendly)
        }
      }
      throw e
    }
  }
)
