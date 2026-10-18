import { inngest } from "./client"
import { NonRetriableError } from "inngest"
import { chatForFeature } from "@/lib/ai-router"
import { createServerClient } from "@/lib/supabase/server"
import { getErrorMessage } from "@/lib/utils"
import { buildLessonPartPrompt, splitLessonContent, type LessonPartKind } from "@/lib/lesson-content"
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

/**
 * Lesson generation order. Each entry is one step with its own 60s budget;
 * split narrow enough that no single NIM call can time out (see live probe
 * sizing in buildLessonPartPrompt).
 */
const LESSON_PARTS: readonly LessonPartKind[] = ["foundation", "examples", "context", "practice"]

export const generateLessonFn = inngest.createFunction(
  {
    id: "generate-lesson",
    triggers: [{ event: "lesson/generate" }],
    retries: 2,
    onFailure: async ({ event }: { event: { data?: { event?: { data?: { jobId?: unknown } } } } }) => {
      const jobId = event?.data?.event?.data?.jobId
      if (typeof jobId === "string" && isValidJobId(jobId)) {
        await markJobFailed(jobId, "Lesson generation kept timing out or hit AI limits. Please try again in a few minutes.")
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

      // Four bounded part-steps: one Extended lesson (~8000 tokens) takes
      // minutes on NIMs, far past a single step's 60s invocation budget
      // (prod: "ProviderError: Request failed: This operation was aborted").
      // Live probes sized each part to ≤1800 tokens; every part is its own
      // step (own 60s budget) and the section arrays merge below.
      type LessonPart = { doc: LessonContent | null; raw: string }
      const lessonSystem = "You are a programming instructor writing a focused lesson. Follow the requested JSON contract exactly."
      const generatePart = async (kind: LessonPartKind, headings: string[]): Promise<LessonPart> => {
        const r = await chatForFeature("lesson", [
          { role: "system", content: lessonSystem },
          { role: "user", content: buildLessonPartPrompt(bundle, kind, headings) },
        ], { jsonMode: true, maxTokens: 1800, timeoutMs: 90000, retries: 2, deadlineMs: 120000 })
        let doc: LessonContent | null = null
        try {
          doc = parseLessonContent(r.content)
        } catch {
          doc = null
        }
        return { doc, raw: r.content }
      }
      const headingsOf = (...parts: (LessonContent | null)[]): string[] =>
        parts
          .flatMap((p) => p?.sections ?? [])
          .filter((s) => s.type === "heading")
          .map((s) => (s as { text: string }).text)
          .slice(0, 12)

      // Parts run in order; each is told what earlier parts covered so the
      // stateless calls extend one lesson instead of repeating topics.
      const parts: LessonPart[] = []
      for (let i = 0; i < LESSON_PARTS.length; i++) {
        const kind = LESSON_PARTS[i] as LessonPartKind
        const prior = headingsOf(...parts.map((p) => p.doc))
        const generated = await step.run(`generate-lesson-part-${i + 1}`, () => generatePart(kind, prior))
        parts.push(generated)
        console.log(
          `[lesson] part ${i + 1}/${LESSON_PARTS.length} (${kind}): ${generated.doc?.sections.length ?? 0} blocks`
        )
      }

      // Parse chain: structured JSON first, legacy marker-split salvage
      // second, fail the job only when nothing usable exists.
      // Quality guard: score <70 regenerates the weakest part once.
      const mergeParts = (...docs: (LessonContent | null)[]): LessonContent | null => {
        const sections = docs.flatMap((p) => p?.sections ?? [])
        return sections.length > 0 ? { sections } : null
      }
      const initial = parts.map((p) => p.doc)
      let doc: LessonContent | null = mergeParts(...initial)
      let rawContent = parts.map((p) => p.raw).join("\n")
      const scoreOf = (d: LessonContent | null) => (d ? lessonQualityScore(d) : 0)
      if (doc && lessonQualityScore(doc) < 70) {
        let weakIndex = 0
        for (let i = 1; i < LESSON_PARTS.length; i++) {
          if (scoreOf(initial[i] ?? null) < scoreOf(initial[weakIndex] ?? null)) weakIndex = i
        }
        const weakKind = LESSON_PARTS[weakIndex] as LessonPartKind
        const priorHeadings = headingsOf(...initial.slice(0, weakIndex))
        console.log(`[lesson] Quality ${lessonQualityScore(doc)} <70, regenerating weakest part (${weakKind}) once`)
        const strictSuffix =
          weakKind === "practice"
            ? " CRITICAL: Must include a PRACTICE SET of 3-4 exercises with full solutions, plus recap. No fluff."
            : weakKind === "context"
              ? " CRITICAL: Must include a concrete real-world use case and 2-3 mistakes each with its fix. No fluff."
              : weakKind === "examples"
                ? " CRITICAL: Must include both runnable code examples as code blocks. No fluff."
                : " CRITICAL: Must include objectives, a plain-words explanation of WHY it works, and one runnable code example. No fluff."
        const regen = await step.run("regenerate-lesson-weak-part", async (): Promise<LessonPart> => {
          try {
            const r2 = await chatForFeature("lesson", [
              { role: "system", content: `${lessonSystem} Quality matters.` },
              { role: "user", content: buildLessonPartPrompt(bundle, weakKind, priorHeadings) + strictSuffix },
            ], { jsonMode: true, maxTokens: 1800, timeoutMs: 90000, retries: 2, deadlineMs: 120000 })
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
          const mergedDocs = [...initial]
          mergedDocs[weakIndex] = regen.doc
          const merged = mergeParts(...mergedDocs)
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
