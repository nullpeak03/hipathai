import { inngest } from "./client"
import { NonRetriableError } from "inngest"
import { chatForFeature } from "@/lib/ai-router"
import { createServerClient } from "@/lib/supabase/server"
import { getErrorMessage } from "@/lib/utils"
import { buildOutlinePrompt, buildPhasePrompt, distributeLessons, ROADMAP_JSON_SYSTEM } from "@/lib/roadmap-prompt"
import { planRoadmapSize, splitCount } from "@/lib/roadmap-sizing"
import { normalizeRoadmapJson, buildOutlineFromRaw, roadmapQualityScore, roadmapDataQualityScore } from "@/lib/roadmap-normalize"
import { deduplicateByTitle } from "@/lib/content-quality"
import { classifyJobError, isValidJobId } from "@/lib/generation-errors"
import { maybePublishRoadmap } from "@/lib/public-publish"
import { sendAdminAlert } from "@/lib/alerts"
import { sleep } from "@/lib/ai-errors"
import type { LessonSpec } from "@/lib/mockData"

/**
 * Breathing room between consecutive AI calls. Provider rate limits punish
 * rapid-fire phase calls, so every phase after the first waits before
 * calling the model.
 */
const PHASE_PACE_MS = 1000

type RoadmapJobData = {
  jobId: string
  goal: string
  level: string
  time: string
  duration: string
  why: string
  style: string
  timeMins: number
  durationDays: number
  userId: string | null
}

export type StepRunner = {
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T>
}

type Outline = { title: string; description: string; phaseTitles: string[] }

function lessonRows(roadmapId: string, phaseId: string, lessons: LessonSpec[], estimatedMinutes: number) {
  return lessons.map((lesson, li) => ({
    id: crypto.randomUUID(),
    roadmap_id: roadmapId,
    phase_id: phaseId,
    idx: li + 1,
    title: lesson.title,
    content_md: `## ${lesson.title}\n\n${lesson.objective || `Learn ${lesson.title} with AI guidance.`}`,
    example_code: `// Example for ${lesson.title}`,
    quiz: lesson.quiz || [{ q: `What is ${lesson.title}?`, options: ["Option A", "Option B", "Option C", "Option D"], correct: 0, explanation: "Review the lesson." }],
    estimated_minutes: estimatedMinutes,
    prerequisites: [] as string[],
  }))
}

async function savePhase(roadmapId: string, phaseTitle: string, pi: number, lessons: LessonSpec[], estimatedMinutes: number) {
  const supabase = createServerClient()
  // The roadmap row can disappear mid-run (user deletes it from the UI while
  // generation continues). Fail loudly with a friendly message instead of a
  // raw FK constraint violation on the phase insert.
  const { data: parent } = await supabase.from("roadmaps").select("id").eq("id", roadmapId).single()
  if (!parent) {
    throw new NonRetriableError("Roadmap was deleted during generation — skipping remaining phases")
  }
  const { data: phase, error: phaseError } = await supabase.from("phases")
    .insert({ roadmap_id: roadmapId, idx: pi + 1, title: phaseTitle })
    .select("id").single()
  if (phaseError || !phase) throw phaseError ?? new Error("Phase insert failed")
  const uniqueLessons = deduplicateByTitle(lessons.map((l) => ({ ...l, title: l.title.trim() })))
  const rows = lessonRows(roadmapId, phase.id, uniqueLessons, estimatedMinutes)
  // Wire linear prerequisites: each lesson requires previous lesson in phase
  for (let i = 1; i < rows.length; i++) {
    rows[i].prerequisites = [rows[i - 1]!.id]
  }
  if (rows.length > 0) {
    const { error: lessonError } = await supabase.from("lessons").insert(rows)
    if (lessonError) throw lessonError
  }
}

async function markJobCompleted(jobId: string, extraResult: Record<string, unknown> = {}) {
  const supabase = createServerClient()
  await supabase.from("async_jobs").upsert({
    id: jobId,
    status: "completed",
    completed_at: new Date().toISOString(),
    result: { roadmapId: jobId, ...extraResult }
  }, { onConflict: "id" })
}

export const generateRoadmapFn = inngest.createFunction(
  {
    id: "generate-roadmap",
    triggers: [{ event: "roadmap/generate" }],
    retries: 3,
    concurrency: { limit: 5 },
    // Terminal marker: runs once when all retries are exhausted. The catch
    // below deliberately leaves retriable errors as `processing` so the UI
    // doesn't show failure while a retry is still pending.
    onFailure: async ({ event }: { event: { data?: { event?: { data?: { jobId?: unknown } } } } }) => {
      const jobId = event?.data?.event?.data?.jobId
      if (typeof jobId === "string" && isValidJobId(jobId)) {
        await markJobFailed(jobId, "Generation kept timing out or hit AI limits. Please try again in a few minutes.")
        await sendAdminAlert("generate-roadmap", "Roadmap job exhausted retries", `jobId: ${jobId}`)
      }
    },
  },
  async ({ event, step }: { event: { data: RoadmapJobData }; step: StepRunner }) => {
    const { jobId, goal, level, time, duration, why, style, timeMins, durationDays, userId } = event.data
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

      const size = planRoadmapSize({ timeMins, durationDays })
      const lessonCounts = distributeLessons(size.lessons, size.phases)
      console.log("[generate] Planned size:", size, `for ${timeMins} min/day x ${durationDays} days`)

      // 1. Outline: titles only (small, fast) — Nemotron 3 Ultra sole-source.
      // Two bounded steps: a lenient first attempt, then a strict
      // regeneration ONLY when the first yields nothing. Each step holds at
      // most ONE model call bounded by the router's 50s step deadline (the
      // old single step chained two 60s calls and tripped the platform
      // invocation cap, surfacing as FUNCTION_INVOCATION_TIMEOUT with no
      // step output.
      // Retriable overloads (429/503) rethrow for Inngest retry; any other
      // failure fails the job with a user-facing error so the learner
      // retries with live AI.
      const firstOutline = await step.run("generate-outline", async (): Promise<Outline | null> => {
        const { content } = await chatForFeature("roadmap", [
          { role: "system", content: ROADMAP_JSON_SYSTEM },
          {
            role: "user",
            content: buildOutlinePrompt({ goal, level, time, duration, why, styles: style, phases: size.phases }),
          },
        ], { jsonMode: true, maxTokens: 1200, timeoutMs: 40000, retries: 0, jsonKeys: ["phases"] })
        let raw: unknown
        try {
          raw = JSON.parse(content) as unknown
        } catch {
          raw = null
        }
        const built = buildOutlineFromRaw(raw, { goal, level, duration }, size.phases)
        if (!built) {
          console.warn(`[generate] Outline empty, will retry once with strict shape. Raw head: ${content.slice(0, 200)}`)
        } else {
          console.log("[generate] Outline ready:", built.title)
        }
        return built
      })
      // Conditional on the memoized first result (deterministic across
      // retries): skipped entirely when the first attempt succeeded. Throws
      // inside the step on a second empty reply so function retries get a
      // FRESH model call (completed steps replay memoized — a throw outside
      // any step would loop on the same empty payload until retries exhaust).
      const outline: Outline = firstOutline ?? await step.run("regenerate-outline-strict", async (): Promise<Outline> => {
        const { content } = await chatForFeature("roadmap", [
          { role: "system", content: ROADMAP_JSON_SYSTEM },
          {
            role: "user",
            content: buildOutlinePrompt({ goal, level, time, duration, why, styles: style, phases: size.phases }) +
              ' CRITICAL: phases MUST be a non-empty array like [{"title":"Python Foundations"},{"title":"Core Data Structures"}]. String arrays are also accepted.',
          },
        ], { jsonMode: true, maxTokens: 1200, timeoutMs: 40000, retries: 0, jsonKeys: ["phases"] })
        let raw: unknown
        try {
          raw = JSON.parse(content) as unknown
        } catch {
          raw = null
        }
        const built = buildOutlineFromRaw(raw, { goal, level, duration }, size.phases)
        if (!built) throw new Error("Ultra returned no phases — cannot build roadmap")
        console.log("[generate] Strict outline ready:", built.title)
        return built
      })

      // 2. Roadmap row first, so status shows title + partial progress early.
      // Upsert + wipe children for retry safety (phases delete cascades lessons).
      await step.run("create-roadmap", async () => {
        const supabase = createServerClient()
        const { error } = await supabase.from("roadmaps").upsert({
          id: jobId,
          user_id: userId,
          title: outline.title,
          description: outline.description,
          goal: goal,
          level: level,
          time_per_day: time,
          duration: duration,
          why: why,
          style: style,
          lessons_total: size.lessons
        }, { onConflict: "id" })
        if (error) throw error
        await supabase.from("phases").delete().eq("roadmap_id", jobId)
        console.log("[generate] Roadmap row ready:", jobId)
      })

      // 3. Bounded steps per phase: large phases are expanded in ≤5-lesson
      // parts (a full-phase call exceeds the ~50s per-step budget) and saved
      // immediately. A killed run keeps everything saved so far.
      const generatePhase = async (idx: number) => {
        const phaseTitle = outline.phaseTitles[idx] ?? `Phase ${idx + 1}`
        const count = lessonCounts[idx] ?? 0
        if (count <= 0) return
        if (idx > 0) {
          await step.run(`pace-phase-${idx + 1}`, () => sleep(PHASE_PACE_MS))
        }
        const chunks = splitCount(count, 4)
        const partSuffix = chunks.length > 1 ? ` in ${chunks.length} parts` : ""
        const lessons: LessonSpec[] = []
        for (let ci = 0; ci < chunks.length; ci++) {
          const chunk = chunks[ci] ?? 0
          if (chunk <= 0) continue
          const previousTitles = lessons.map((l) => l.title)
          const stepName = chunks.length > 1 ? `generate-phase-${idx + 1}-part-${ci + 1}` : `generate-phase-${idx + 1}`
          const partLessons: LessonSpec[] = await step.run(stepName, async (): Promise<LessonSpec[]> => {
            const { content, modelUsed } = await chatForFeature("roadmap", [
              { role: "system", content: ROADMAP_JSON_SYSTEM },
              {
                role: "user",
                content: buildPhasePrompt({
                  goal, level, time, duration, why, styles: style,
                  phaseIndex: idx + 1, phaseCount: size.phases, phaseTitle, lessonCount: chunk,
                  previousTitles: previousTitles.length > 0 ? previousTitles : undefined,
                })
              }
            ], { jsonMode: true, maxTokens: Math.max(1500, Math.min(4000, chunk * 220)), timeoutMs: 45000, retries: 1, jsonKeys: ["lessons"] })
            const wrapped = normalizeRoadmapJson(JSON.parse(content) as unknown, { goal, level, duration })?.phases?.[0]
            const valid = (wrapped?.lessons ?? [])
              .filter((l) => l.title && l.title.trim().length > 0)
            if (valid.length === 0) throw new Error(`Ultra returned no lessons for phase ${idx + 1}${partSuffix}`)
            console.log(`[generate] Phase ${idx + 1} part ${ci + 1}/${chunks.length} ready via ${modelUsed}: ${valid.length} lessons`)
            return valid
          })
          lessons.push(...partLessons)
        }
        const finalLessons = deduplicateByTitle(lessons.map((l) => ({ ...l, title: l.title.trim() }))).slice(0, count)
        if (finalLessons.length === 0) throw new Error(`Ultra returned no lessons for phase ${idx + 1}${partSuffix}`)
        await step.run(`save-phase-${idx + 1}`, async () => {
          const intensity = Math.max(0.5, Math.min(2, timeMins / 60))
          const estimatedMinutes = Math.max(5, Math.min(20, Math.round(10 * intensity)))
          await savePhase(jobId, phaseTitle, idx, finalLessons, estimatedMinutes)
          const supabase = createServerClient()
          await supabase.from("async_jobs").upsert({
            id: jobId,
            status: "processing",
            result: { roadmapId: jobId, completedPhases: idx + 1, totalPhases: size.phases }
          }, { onConflict: "id" })
          console.log(`[generate] Phase ${idx + 1} saved`)
        })
      }

      for (let pi = 0; pi < size.phases; pi += 2) {
        await Promise.all([
          generatePhase(pi),
          pi + 1 < size.phases ? generatePhase(pi + 1) : Promise.resolve(),
        ])
      }


      // Quality gate: validate full roadmap before finalizing
      await step.run("quality-gate", async () => {
        const supabase = createServerClient()
        const { data: roadmap } = await supabase
          .from("roadmaps")
          .select("id,title,description,lessons_total")
          .eq("id", jobId)
          .single()
        const { data: phases } = await supabase
          .from("phases")
          .select("id,idx,title")
          .eq("roadmap_id", jobId)
          .order("idx")
        const { data: lessons } = await supabase
          .from("lessons")
          .select("id,phase_id,idx,title,content_md,example_code,content_json,quiz,quiz_bank,estimated_minutes,prerequisites")
          .eq("roadmap_id", jobId)
          .order("idx")
        const { toRoadmapData } = await import("@/lib/roadmap-shape")
        const full = toRoadmapData(
          roadmap as import("@/lib/roadmap-shape").RoadmapRow,
          (phases ?? []) as import("@/lib/roadmap-shape").PhaseRow[],
          (lessons ?? []) as import("@/lib/roadmap-shape").LessonRow[]
        )
        const quality = roadmapDataQualityScore(full)
        console.log(`[generate] Roadmap quality score: ${quality}/100`)
        if (quality < 60) {
          console.warn(`[generate] Roadmap quality ${quality} < 60 — proceeding anyway`)
        }
      })

      await step.run("finalize-roadmap", async () => {
        const supabase = createServerClient()
        const { count } = await supabase.from("lessons").select("id", { count: "exact", head: true }).eq("roadmap_id", jobId)
        await supabase.from("roadmaps").update({ lessons_total: count ?? size.lessons }).eq("id", jobId)
        await markJobCompleted(jobId)
        console.log("[generate] Successfully completed job:", jobId)
      })

      // Review queue: submit the finished roadmap for manual review instead of
      // auto-publishing. Best-effort — never fails the user's job.
      await step.run("submit-for-review", async () => {
        try {
          const supabase = createServerClient()
          await supabase.from("roadmap_review_queue").insert({
            roadmap_id: jobId,
            user_id: userId,
            status: "pending",
            reason: "Auto-submitted after generation",
          })
        } catch (e) {
          console.warn("[review] submit failed:", e instanceof Error ? e.message : e)
        }
      })

      jobCompleted = true
      return { modelUsed: "async", jobId, phases: size.phases }
    } catch (e) {
      if (!jobCompleted) {
        const { retriable, friendly } = classifyJobError(e)
        if (retriable) {
          // Transient (429/5xx/timeout): stay `processing` so the UI keeps
          // polling while Inngest retries; onFailure marks it failed if every
          // attempt is exhausted. Never surface raw quota/billing text.
          try {
            const supabase = createServerClient()
            await supabase.from("async_jobs").upsert({
              id: jobId,
              status: "processing",
              error: friendly,
            }, { onConflict: "id" })
          } catch (noteErr) {
            console.warn("[generate] Failed to note retriable error:", getErrorMessage(noteErr))
          }
          console.warn("[generate] Job hit transient error, leaving for retry:", jobId, friendly)
        } else {
          await markJobFailed(jobId, friendly)
          console.error("[generate] Job failed:", jobId, friendly)
        }
      }
      throw e
    }
  }
)

export async function markJobFailed(jobId: string, error: string) {
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
