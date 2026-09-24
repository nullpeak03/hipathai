import { inngest } from "./client"
import { NonRetriableError } from "inngest"
import { chatForFeature } from "@/lib/ai-router"
import { createServerClient } from "@/lib/supabase/server"
import { getErrorMessage } from "@/lib/utils"
import { buildOutlinePrompt, buildPhasePrompt, distributeLessons, ROADMAP_JSON_SYSTEM } from "@/lib/roadmap-prompt"
import { planRoadmapSize } from "@/lib/roadmap-sizing"
import { normalizeRoadmapJson } from "@/lib/roadmap-normalize"
import { classifyJobError, isValidJobId } from "@/lib/generation-errors"
import { sleep } from "@/lib/ai-errors"
import type { LessonSpec } from "@/lib/mockData"

/**
 * Breathing room between consecutive AI calls. The Gemini free-tier fallback
 * pool allows 20 req/min — rapid-fire phase calls burst straight through it,
 * so every phase after the first waits before calling the model.
 */
const PHASE_PACE_MS = 4000

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
  const rows = lessonRows(roadmapId, phase.id, lessons, estimatedMinutes)
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
    // Terminal marker: runs once when all retries are exhausted. The catch
    // below deliberately leaves retriable errors as `processing` so the UI
    // doesn't show failure while a retry is still pending.
    onFailure: async ({ event }: { event: { data?: { event?: { data?: { jobId?: unknown } } } } }) => {
      const jobId = event?.data?.event?.data?.jobId
      if (typeof jobId === "string" && isValidJobId(jobId)) {
        await markJobFailed(jobId, "Generation hit repeated AI rate limits. Please try again in a few minutes.")
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

      // 1. Outline: titles only (small, fast) — Nemotron 3 Ultra sole-source. No fallback.
      // Retriable overloads (429/503) rethrow for Inngest retry; any other failure
      // fails the job with a user-facing error so the learner retries with live AI.
      const outline: Outline = await step.run("generate-outline", async (): Promise<Outline> => {
        const { content } = await chatForFeature("roadmap", [
          { role: "system", content: ROADMAP_JSON_SYSTEM },
          { role: "user", content: buildOutlinePrompt({ goal, level, time, duration, why, styles: style, phases: size.phases }) }
        ], { jsonMode: true, maxTokens: 800, timeoutMs: 60000 })
        const raw = JSON.parse(content) as {
          title?: unknown
          description?: unknown
          phases?: unknown
        }
        const title = typeof raw.title === "string" && raw.title.trim()
          ? raw.title.trim().slice(0, 200)
          : `Roadmap for ${goal}`
        const description = typeof raw.description === "string" && raw.description.trim()
          ? raw.description
          : `A ${duration} roadmap for ${goal} at ${level} level`
        const titles = (Array.isArray(raw.phases) ? raw.phases : [])
          .map((p) => (p && typeof p === "object" ? (p as { title?: unknown }).title : null))
          .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
          .map((t) => t.trim().slice(0, 200))
        if (titles.length === 0) throw new Error("Ultra returned no phases — cannot build roadmap")
        // Reconcile to the planned count (pad generic, truncate extras)
        while (titles.length < size.phases) titles.push(`Phase ${titles.length + 1}`)
        console.log("[generate] Outline ready:", title)
        return { title, description, phaseTitles: titles.slice(0, size.phases) }
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

      // 3. One bounded step per phase: generate lessons, save immediately.
      // Worst case per step stays far under serverless execution limits,
      // and a killed run keeps everything saved so far.
      for (let pi = 0; pi < size.phases; pi++) {
        const phaseTitle = outline.phaseTitles[pi] ?? `Phase ${pi + 1}`
        const count = lessonCounts[pi] ?? 0
        if (count <= 0) continue
        if (pi > 0) {
          // Memoized pacing step (runs once, survives retries) — see PHASE_PACE_MS.
          await step.run(`pace-phase-${pi + 1}`, () => sleep(PHASE_PACE_MS))
        }
        const lessons: LessonSpec[] = await step.run(`generate-phase-${pi + 1}`, async (): Promise<LessonSpec[]> => {
          const { content, modelUsed } = await chatForFeature("roadmap", [
            { role: "system", content: ROADMAP_JSON_SYSTEM },
            {
              role: "user",
              content: buildPhasePrompt({
                goal, level, time, duration, why, styles: style,
                phaseIndex: pi + 1, phaseCount: size.phases, phaseTitle, lessonCount: count
              })
            }
          ], { jsonMode: true, maxTokens: Math.max(1500, Math.min(4000, count * 220)), timeoutMs: 100000 })
          const wrapped = normalizeRoadmapJson(JSON.parse(content) as unknown, { goal, level, duration })?.phases?.[0]
          // Ultra decides lesson count — trust its output without hard slice
          const valid = (wrapped?.lessons ?? [])
            .filter((l) => l.title && l.title.trim().length > 0)
          if (valid.length === 0) throw new Error(`Ultra returned no lessons for phase ${pi + 1}`)
          console.log(`[generate] Phase ${pi + 1} ready via ${modelUsed}: ${valid.length} lessons`)
          return valid
        })
        await step.run(`save-phase-${pi + 1}`, async () => {
          const intensity = Math.max(0.5, Math.min(2, timeMins / 60))
          const estimatedMinutes = Math.max(5, Math.min(20, Math.round(10 * intensity)))
          await savePhase(jobId, phaseTitle, pi, lessons, estimatedMinutes)
          const supabase = createServerClient()
          await supabase.from("async_jobs").upsert({
            id: jobId,
            status: "processing",
            result: { roadmapId: jobId, completedPhases: pi + 1, totalPhases: size.phases }
          }, { onConflict: "id" })
          console.log(`[generate] Phase ${pi + 1} saved`)
        })
      }

      await step.run("finalize-roadmap", async () => {
        const supabase = createServerClient()
        const { count } = await supabase.from("lessons").select("id", { count: "exact", head: true }).eq("roadmap_id", jobId)
        await supabase.from("roadmaps").update({ lessons_total: count ?? size.lessons }).eq("id", jobId)
        await markJobCompleted(jobId)
        console.log("[generate] Successfully completed job:", jobId)
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
