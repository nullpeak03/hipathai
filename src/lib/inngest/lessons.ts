import { inngest } from "./client"
import { NonRetriableError } from "inngest"
import { chatForFeature } from "@/lib/ai-router"
import { createServerClient } from "@/lib/supabase/server"
import { getErrorMessage } from "@/lib/utils"
import { buildLessonPartPrompt, splitLessonContent, needsRealContent, type LessonPartKind } from "@/lib/lesson-content"
import { parseLessonContent, flattenLessonContent, lessonQualityScore, type LessonContent } from "@/lib/lesson-content-blocks"
import { classifyJobError, isValidJobId } from "@/lib/generation-errors"
import { failureDetails, markJobFailed, type StepRunner } from "./functions"
import { sendAdminAlert } from "@/lib/alerts"
import { elapsedSinceStart } from "@/lib/job-health"
import {
  describePlan,
  remainingBudgetMs,
  remediationPlan,
  REGEN_BUDGET_MS,
} from "@/lib/lesson-budget"

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
 *
 * The two waves plus optional remediation are bounded by
 * LESSON_ATTEMPT_BUDGET_MS (lib/lesson-budget): remediation only runs when the
 * remaining time covers it, so one attempt cannot grow into a six-minute
 * spinner. Whatever is usable is published early, so the reader is never
 * blocked on the polish.
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
  async ({ event, step, attempt }: { event: { data: LessonJobData }; step: StepRunner; attempt?: number }) => {
    const { jobId, lessonId, userId } = event.data
    if (!isValidJobId(jobId)) {
      throw new NonRetriableError(`Invalid jobId (not a UUID): ${String(jobId).slice(0, 60)}`)
    }
    console.log("[lesson] Started job:", jobId, "lesson:", lessonId, "attempt:", attempt ?? 0)

    let jobCompleted = false

    try {
      // Inngest runs every `step.run` in its own invocation, so a local
      // `Date.now()` cannot measure the whole attempt — it measured the last
      // step (979ms on a 40s job). This step is memoized inside the attempt
      // and gets a new id on a retry, so the value is a durable per-attempt
      // anchor: stable across steps, reset when a retry starts.
      const attemptStartedAt = await step.run(`attempt-anchor-${attempt ?? 0}`, async () => Date.now())

      await step.run("mark-processing", async () => {
        const supabase = createServerClient()
        // Keep the timestamp written by the route that created the job. It is
        // the anchor for user-visible latency (`durationMs`), so a retry must
        // not reset it to "now" and hide the first attempt's time.
        const { data: existing } = await supabase
          .from("async_jobs")
          .select("started_at")
          .eq("id", jobId)
          .maybeSingle()
        await supabase.from("async_jobs").upsert({
          id: jobId,
          status: "processing",
          started_at: (existing as { started_at?: string | null } | null)?.started_at ?? new Date().toISOString(),
          user_id: userId,
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
      type LessonPart = { doc: LessonContent | null; raw: string; modelUsed?: string }
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
      const generatePart = async (
        kind: LessonPartKind,
        headings: string[],
        budgetMs: number = PART_BUDGET_MS
      ): Promise<LessonPart> => {
        const partStartedAt = Date.now()
        const call = async (suffix: string): Promise<LessonPart | null> => {
          const remaining = budgetMs - (Date.now() - partStartedAt)
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
          return { doc, raw: r.content, modelUsed: r.modelUsed }
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
          const left = budgetMs - (Date.now() - partStartedAt)
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

      // Parse chain: structured JSON first, legacy marker-split salvage
      // second, fail the job only when nothing usable exists.
      //
      // Remediation is optional and budgeted (lib/lesson-budget). Exactly one
      // mechanism runs per attempt: repair missing parts, or regenerate the
      // weakest part of a complete-but-poor lesson. Historically both could
      // run back to back, stacking ~170s on top of the two waves.
      const mergeParts = (...merged: (LessonContent | null)[]): LessonContent | null => {
        const sections = merged.flatMap((p) => p?.sections ?? [])
        return sections.length > 0 ? { sections } : null
      }
      const scoreOf = (d: LessonContent | null) => (d ? lessonQualityScore(d) : 0)
      const docs = parts.map((p) => p.doc)
      let doc: LessonContent | null = mergeParts(...docs)
      let rawContent = parts.map((p) => p.raw).join("\n")

      const plan = remediationPlan({
        parts: LESSON_PARTS.map((kind, index) => ({
          kind,
          present: Boolean(docs[index]),
          score: scoreOf(docs[index] ?? null),
        })),
        score: doc ? lessonQualityScore(doc) : 0,
        remainingMs: remainingBudgetMs(attemptStartedAt, Date.now()),
      })
      console.log(
        `[lesson] quality ${doc ? lessonQualityScore(doc) : 0}, ` +
          `${Math.round(remainingBudgetMs(attemptStartedAt, Date.now()) / 1000)}s of attempt budget left - remediation: ${describePlan(plan)}`
      )

      // Publish what already works before spending more model time. The job
      // stays "processing" with `partial: true`, so the status route can tell
      // the reader to open the lesson while the last part finishes. Only prose
      // is written here: `content_json` stays null until the job completes, so
      // the public proof count never credits a half-finished lesson.
      //
      // Never replaces readable content: a failed regeneration must leave the
      // lesson the learner already had intact.
      if (plan.kind !== "none" && doc) {
        const draftMd = flattenLessonContent(doc)
        const draftCodeBlock = doc.sections.find((b) => b.type === "code")
        const draftCode = draftCodeBlock ? draftCodeBlock.code : ""
        await step.run("publish-draft", async () => {
          const supabase = createServerClient()
          const { data: existing } = await supabase
            .from("lessons")
            .select("content_md")
            .eq("id", lessonId)
            .maybeSingle()
          if (!needsRealContent((existing as { content_md?: string | null } | null)?.content_md)) {
            console.log("[lesson] Existing content is readable; not replacing it with a draft")
            return
          }
          const { error } = await supabase
            .from("lessons")
            .update({ content_md: draftMd, example_code: draftCode })
            .eq("id", lessonId)
          if (error) throw error
          await supabase.from("async_jobs").upsert({
            id: jobId,
            status: "processing",
            result: { lessonId, partial: true },
          }, { onConflict: "id" })
          console.log("[lesson] Draft content published while remediation runs")
        })
      }

      if (plan.kind === "repair") {
        // Repair only the parts the plan selected; each call gets whatever is
        // left of the attempt budget, capped by the normal part budget.
        const repairBudgetMs = Math.min(
          PART_BUDGET_MS,
          Math.max(10_000, remainingBudgetMs(attemptStartedAt, Date.now()) - 5_000)
        )
        const repaired = await Promise.all(
          plan.parts.map((kind) =>
            step.run(`repair-lesson-${kind}`, () =>
              generatePart(kind, headingsOf(...docs), repairBudgetMs)
            )
          )
        )
        plan.parts.forEach((kind, k) => {
          const partIndex = LESSON_PARTS.indexOf(kind)
          const generated = repaired[k] as LessonPart
          docs[partIndex] = generated.doc
          if (generated.raw) rawContent += `\n${generated.raw}`
          if (generated.doc) {
            console.log(`[lesson] repaired ${kind}: ${generated.doc.sections.length} blocks`)
          }
        })
        doc = mergeParts(...docs)
      } else if (plan.kind === "regenerate") {
        const weakIndex = LESSON_PARTS.indexOf(plan.part)
        const weakKind = plan.part
        const earlierHeadings = headingsOf(...docs.slice(0, weakIndex))
        const regenDeadlineMs = Math.min(
          REGEN_BUDGET_MS,
          Math.max(10_000, remainingBudgetMs(attemptStartedAt, Date.now()) - 5_000)
        )
        const strictSuffix =
          weakKind === "practice"
            ? " CRITICAL: Must include a PRACTICE SET of 3-4 exercises with full solutions, plus recap. No fluff."
            : weakKind === "context"
              ? " CRITICAL: Must include a concrete real-world use case and 2-3 mistakes each with their fix. No fluff."
              : weakKind === "examples"
                ? " CRITICAL: Must include both runnable code examples as code blocks. No fluff."
                : " CRITICAL: Must include objectives, a plain-words explanation of WHY it works, and one runnable code example. No fluff."
        console.log(
          `[lesson] quality ${scoreOf(doc)} - regenerating weakest part (${weakKind}) within ${Math.round(regenDeadlineMs / 1000)}s`
        )
        const regen = await step.run("regenerate-lesson-weak-part", async (): Promise<LessonPart> => {
          try {
            const r2 = await chatForFeature("lesson", [
              { role: "system", content: `${lessonSystem} Quality matters.` },
              { role: "user", content: buildLessonPartPrompt(bundle, weakKind, earlierHeadings) + strictSuffix },
            ], {
              jsonMode: true,
              maxTokens: partTokens[weakKind],
              timeoutMs: Math.min(60_000, regenDeadlineMs),
              retries: 0,
              deadlineMs: regenDeadlineMs,
            })
            let redone: LessonContent | null = null
            try {
              redone = parseLessonContent(r2.content)
            } catch {
              redone = null
            }
            return { doc: redone, raw: r2.content, modelUsed: r2.modelUsed }
          } catch (e2) {
            console.warn("[lesson] Regeneration failed, keeping original:", getErrorMessage(e2 as Error))
            return { doc: null, raw: "" }
          }
        })
        if (regen.doc) {
          const mergedDocs = [...docs]
          mergedDocs[weakIndex] = regen.doc
          const merged = mergeParts(...mergedDocs)
          if (merged && lessonQualityScore(merged) >= scoreOf(doc)) {
            doc = merged
            docs[weakIndex] = regen.doc
            rawContent = regen.raw
            console.log(`[lesson] Regenerated quality ${lessonQualityScore(merged)}`)
          }
        }
      }
      const missingParts = LESSON_PARTS.filter((_, index) => !docs[index])
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
        // `started_at` is written once by the route that created the job, so
        // the delta covers retries too (a fresh in-process timer would only
        // measure the final attempt). modelsUsed/missingParts feed the sweep
        // cron's health alert (lib/job-health).
        const { data: jobRow } = await supabase
          .from("async_jobs")
          .select("started_at")
          .eq("id", jobId)
          .maybeSingle()
        const durationMs =
          elapsedSinceStart(jobRow?.started_at as string | null | undefined, Date.now()) ??
          Date.now() - attemptStartedAt
        await supabase.from("async_jobs").upsert({
          id: jobId,
          status: "completed",
          completed_at: new Date().toISOString(),
          // missingParts is diagnostic only: partial content still ships so a
          // provider hiccup never blocks the learner. `remediation` records
          // which optional step ran (or why it was skipped), so budget-driven
          // skips are visible instead of silently changing lesson shape.
          result: {
            lessonId,
            missingParts,
            durationMs,
            attemptMs: Date.now() - attemptStartedAt,
            remediation: plan.kind === "repair"
              ? `repair:${plan.parts.join("+")}`
              : plan.kind === "regenerate"
                ? `regenerate:${plan.part}`
                : `none:${plan.reason}`,
            modelsUsed: [...new Set(parts.map((p) => p.modelUsed).filter((m): m is string => typeof m === "string"))],
          },
        }, { onConflict: "id" })
        console.log("[lesson] Job marked completed:", jobId, "missing:", missingParts.join(",") || "none")
      })

      jobCompleted = true
      console.log(`[lesson] Successfully completed job: ${jobId} in ${Math.round((Date.now() - attemptStartedAt) / 1000)}s (attempt)`)
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
