import { inngest } from "./client"
import { NonRetriableError } from "inngest"
import { chatForFeature } from "@/lib/ai-router"
import { createServerClient } from "@/lib/supabase/server"
import { getErrorMessage } from "@/lib/utils"
import { buildLessonPartPrompt, splitLessonContent, type LessonPartKind } from "@/lib/lesson-content"
import { parseLessonContent, flattenLessonContent, lessonQualityScore, type LessonContent } from "@/lib/lesson-content-blocks"
import { classifyJobError, isValidJobId } from "@/lib/generation-errors"
import { failureDetails, markJobFailed, type StepRunner } from "./functions"
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
 * Lesson generation parts. Each is its own step with a single model call
 * (90s call / 100s absolute deadline, no in-call retries) so the whole
 * lesson stays well inside the 300s route budget. Split narrow enough that
 * no single NIM call can time out (see live probe sizing in
 * buildLessonPartPrompt).
 */
const LESSON_PARTS: readonly LessonPartKind[] = ["foundation", "examples", "context", "practice"]

export const generateLessonFn = inngest.createFunction(
  {
    id: "generate-lesson",
    triggers: [{ event: "lesson/generate" }],
    retries: 2,
    onFailure: async ({ event }: { event: Parameters<typeof failureDetails>[0] }) => {
      const { jobId, message, raw } = failureDetails(
        event,
        "Lesson generation kept timing out or hit AI limits. Please try again in a few minutes."
      )
      if (!jobId) return
      await markJobFailed(jobId, message, { preserveExisting: true, details: raw })
      await sendAdminAlert(
        "generate-lesson",
        "Lesson job exhausted retries",
        `jobId: ${jobId}\n${raw.slice(0, 600) || "no error message in failure event"}`
      )
    },
  },
  async ({ event, step }: { event: { data: LessonJobData }; step: StepRunner }) => {
    const { jobId, lessonId, userId } = event.data
    if (!isValidJobId(jobId)) {
      throw new NonRetriableError(`Invalid jobId (not a UUID): ${String(jobId).slice(0, 60)}`)
    }
    const jobStartedAt = Date.now()
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

      // Four bounded part-steps. The whole lesson (~8000 tokens) takes
      // minutes on NIMs, far past a single step's budget. Live probes sized
      // each part to ≤1800 tokens; every part is its own step and the section
      // arrays merge below.
      type LessonPart = { doc: LessonContent | null; raw: string }
      const lessonSystem = "You are a programming instructor writing a focused lesson. Follow the requested JSON contract exactly."
      const STRICT_SUFFIX =
        " CRITICAL: Return ONLY valid JSON matching the required shape. No prose, no markdown fences. Inside string values escape every line break as \\n and every backslash as \\\\."
      // Two attempts share one part window: a fast failure (429, 404 fallback,
      // malformed JSON) still gets a second try, while a slow timeout does not
      // double the step's latency. Practice emits the most tokens, so it gets
      // a larger cap to avoid truncating its JSON.
      const PART_BUDGET_MS = 100000
      const PART_TIMEOUT_MS = 90000
      const MIN_RETRY_MS = 25000
      const partTokens: Record<LessonPartKind, number> = {
        foundation: 1800,
        examples: 2200,
        context: 1800,
        practice: 2600,
      }
      const generatePart = async (kind: LessonPartKind, headings: string[]): Promise<LessonPart> => {
        const partStartedAt = Date.now()
        const call = async (suffix: string): Promise<LessonPart | null> => {
          const remaining = PART_BUDGET_MS - (Date.now() - partStartedAt)
          if (remaining < 5000) return null
          const r = await chatForFeature("lesson", [
            { role: "system", content: lessonSystem },
            { role: "user", content: buildLessonPartPrompt(bundle, kind, headings) + suffix },
          ], {
            jsonMode: true,
            maxTokens: partTokens[kind],
            retries: 0,
            timeoutMs: Math.min(PART_TIMEOUT_MS, remaining),
            deadlineMs: remaining,
          })
          let doc: LessonContent | null = null
          try {
            doc = parseLessonContent(r.content)
          } catch {
            doc = null
          }
          return { doc, raw: r.content }
        }
        for (let attempt = 0; attempt < 2; attempt++) {
          const suffix = attempt === 0 ? "" : STRICT_SUFFIX
          try {
            const result = await call(suffix)
            if (!result) break
            if (result.doc) return result
            console.warn(`[lesson] part ${kind} returned unusable JSON (attempt ${attempt + 1}/2)`)
          } catch (e) {
            console.warn(`[lesson] part ${kind} attempt ${attempt + 1}/2 failed:`, getErrorMessage(e as Error))
          }
          const left = PART_BUDGET_MS - (Date.now() - partStartedAt)
          if (left < MIN_RETRY_MS) {
            console.warn(`[lesson] part ${kind}: only ${left}ms of its budget left, not retrying`)
            break
          }
        }
        return { doc: null, raw: "" }
      }
      const headingsOf = (...parts: (LessonContent | null)[]): string[] =>
        parts
          .flatMap((p) => p?.sections ?? [])
          .filter((s) => s.type === "heading")
          .map((s) => (s as { text: string }).text)
          .slice(0, 12)

      // Latency: these four parts used to run serially, so a slow model made
      // every lesson take 3-6 minutes. Only the foundation part needs to come
      // first (it establishes the concepts); examples/context/practice are
      // independent and run in parallel — two waves instead of four.
      const foundation = await step.run("generate-lesson-part-1", () => generatePart("foundation", []))
      const priorHeadings = headingsOf(foundation.doc)
      const rest = await Promise.all(
        LESSON_PARTS.slice(1).map((kind, index) =>
          step.run(`generate-lesson-part-${index + 2}`, () => generatePart(kind, priorHeadings))
        )
      )
      const parts: LessonPart[] = [foundation, ...rest]
      parts.forEach((generated, i) => {
        if (generated.doc) {
          console.log(
            `[lesson] part ${i + 1}/${LESSON_PARTS.length} (${LESSON_PARTS[i]}): ${generated.doc.sections.length} blocks`
          )
        } else {
          console.warn(`[lesson] part ${i + 1}/${LESSON_PARTS.length} (${LESSON_PARTS[i]}): MISSING`)
        }
      })

      // A provider hiccup must not silently ship a hollow lesson. Any part the
      // parallel wave dropped gets one dedicated regeneration with a fresh
      // budget (the successful parts stay memoized, so nothing is redone).
      const missingIndexes = LESSON_PARTS.map((_, i) => i).filter((i) => !parts[i]?.doc)
      if (missingIndexes.length > 0) {
        console.warn(
          `[lesson] ${missingIndexes.length} part(s) missing (${missingIndexes.map((i) => LESSON_PARTS[i]).join(", ")}) — repairing once`
        )
        const repaired = await Promise.all(
          missingIndexes.map((i) =>
            step.run(`repair-lesson-${LESSON_PARTS[i]}`, () =>
              generatePart(LESSON_PARTS[i] as LessonPartKind, headingsOf(...parts.map((p) => p.doc)))
            )
          )
        )
        missingIndexes.forEach((partIndex, k) => {
          parts[partIndex] = repaired[k] as LessonPart
        })
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
      const missingBeforeGuard = LESSON_PARTS.filter((_, i) => !initial[i])
      if (doc && (missingBeforeGuard.length > 0 || lessonQualityScore(doc) < 70)) {
        let weakIndex = 0
        for (let i = 1; i < LESSON_PARTS.length; i++) {
          if (scoreOf(initial[i] ?? null) < scoreOf(initial[weakIndex] ?? null)) weakIndex = i
        }
        const weakKind = LESSON_PARTS[weakIndex] as LessonPartKind
        const earlierHeadings = headingsOf(...initial.slice(0, weakIndex))
        console.log(
          `[lesson] Quality ${lessonQualityScore(doc)}${missingBeforeGuard.length > 0 ? `, ${missingBeforeGuard.length} part(s) missing` : ""} — regenerating weakest part (${weakKind}) once`
        )
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
              { role: "user", content: buildLessonPartPrompt(bundle, weakKind, earlierHeadings) + strictSuffix },
            ], { jsonMode: true, maxTokens: partTokens[weakKind], timeoutMs: 60000, retries: 0, deadlineMs: 70000 })
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
            initial[weakIndex] = regen.doc
            rawContent = regen.raw
            console.log(`[lesson] Regenerated quality ${lessonQualityScore(merged)}`)
          }
        }
      }
      const missingParts = LESSON_PARTS.filter((_, i) => !initial[i])
      if (missingParts.length > 0) {
        console.warn(`[lesson] Saving partial lesson — missing: ${missingParts.join(", ")}`)
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
          // missingParts is diagnostic only: partial content still ships so a
          // provider hiccup never blocks the learner.
          result: { lessonId, missingParts },
        }, { onConflict: "id" })
        console.log("[lesson] Job marked completed:", jobId, "missing:", missingParts.join(",") || "none")
      })

      jobCompleted = true
      console.log(`[lesson] Successfully completed job: ${jobId} in ${Math.round((Date.now() - jobStartedAt) / 1000)}s`)
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
