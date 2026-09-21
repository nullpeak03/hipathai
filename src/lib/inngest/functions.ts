import { inngest } from "./client"
import { NonRetriableError } from "inngest"
import { chatForFeature } from "@/lib/ai-router"
import { createServerClient } from "@/lib/supabase/server"
import { getErrorMessage } from "@/lib/utils"
import { buildOutlinePrompt, buildPhasePrompt, distributeLessons, ROADMAP_JSON_SYSTEM } from "@/lib/roadmap-prompt"
import { planRoadmapSize } from "@/lib/roadmap-sizing"
import { normalizeRoadmapJson } from "@/lib/roadmap-normalize"
import { isValidJobId } from "@/lib/generation-errors"
import type { LessonSpec, RoadmapSpec } from "@/lib/mockData"

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

/** Deterministic substitute when AI fails for one phase — keeps every
 *  roadmap complete instead of failing the whole job. */
function templatePhaseLessons(goal: string, phaseTitle: string, count: number): LessonSpec[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => ({
    title: `${phaseTitle} — Part ${i + 1}`,
    objective: `Build practical ${goal} skills in ${phaseTitle} with guided exercises.`,
  }))
}

function lessonRows(roadmapId: string, phaseId: string, lessons: LessonSpec[]) {
  return lessons.map((lesson, li) => ({
    id: crypto.randomUUID(),
    roadmap_id: roadmapId,
    phase_id: phaseId,
    idx: li + 1,
    title: lesson.title,
    content_md: `## ${lesson.title}\n\n${lesson.objective || `Learn ${lesson.title} with AI guidance.`}`,
    example_code: `// Example for ${lesson.title}`,
    quiz: lesson.quiz || [{ q: `What is ${lesson.title}?`, options: ["Option A", "Option B", "Option C", "Option D"], correct: 0, explanation: "Review the lesson." }]
  }))
}

async function savePhase(roadmapId: string, phaseTitle: string, pi: number, lessons: LessonSpec[]) {
  const supabase = createServerClient()
  const { data: phase, error: phaseError } = await supabase.from("phases")
    .insert({ roadmap_id: roadmapId, idx: pi + 1, title: phaseTitle })
    .select("id").single()
  if (phaseError || !phase) throw phaseError ?? new Error("Phase insert failed")
  const rows = lessonRows(roadmapId, phase.id, lessons)
  if (rows.length > 0) {
    const { error: lessonError } = await supabase.from("lessons").insert(rows)
    if (lessonError) throw lessonError
  }
}

async function saveFullRoadmap(
  jobId: string,
  userId: string | null,
  meta: { goal: string; level: string; time: string; duration: string; why: string; style: string },
  spec: RoadmapSpec
) {
  const supabase = createServerClient()
  // Retry safety: wipe any partial save first (roadmap delete cascades phases/lessons).
  await supabase.from("roadmaps").delete().eq("id", jobId)
  const phases = spec.phases || []
  const { error: roadmapError } = await supabase.from("roadmaps").insert({
    id: jobId,
    user_id: userId,
    title: spec.title,
    description: spec.description,
    goal: meta.goal,
    level: meta.level,
    time_per_day: meta.time,
    duration: meta.duration,
    why: meta.why,
    style: meta.style,
    lessons_total: phases.reduce((a: number, p) => a + (p.lessons?.length || 0), 0)
  })
  if (roadmapError) throw roadmapError
  for (const [pi, phase] of phases.entries()) {
    await savePhase(jobId, phase.title, pi, phase.lessons || [])
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
  { id: "generate-roadmap", triggers: [{ event: "roadmap/generate" }], retries: 2 },
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

      // 1. Outline: titles only (small, fast). Total AI failure here falls
      // back to the static template roadmap via the existing fast path.
      const outline: Outline | null = await step.run("generate-outline", async (): Promise<Outline | null> => {
        try {
          const { content } = await chatForFeature("roadmap", [
            { role: "system", content: ROADMAP_JSON_SYSTEM },
            { role: "user", content: buildOutlinePrompt({ goal, level, time, duration, why, phases: size.phases }) }
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
          if (titles.length === 0) throw new Error("Empty outline")
          // Reconcile to the planned count (pad generic, truncate extras)
          while (titles.length < size.phases) titles.push(`Phase ${titles.length + 1}`)
          console.log("[generate] Outline ready:", title)
          return { title, description, phaseTitles: titles.slice(0, size.phases) }
        } catch (e) {
          console.error("[generate] Outline failed:", getErrorMessage(e))
          return null
        }
      })

      if (!outline) {
        const fallback = generateFallbackRoadmap(goal, level, duration)
        await step.run("save-fallback-roadmap", async () => {
          await saveFullRoadmap(jobId, userId, { goal, level, time, duration, why, style }, fallback)
          await markJobCompleted(jobId)
          console.log("[generate] Successfully completed job with fallback:", jobId)
        })
        jobCompleted = true
        return { modelUsed: "fallback", jobId, roadmap: fallback }
      }

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
        const lessons: LessonSpec[] = await step.run(`generate-phase-${pi + 1}`, async (): Promise<LessonSpec[]> => {
          try {
            const { content, modelUsed } = await chatForFeature("roadmap", [
              { role: "system", content: ROADMAP_JSON_SYSTEM },
              {
                role: "user",
                content: buildPhasePrompt({
                  goal, level, time, duration, why,
                  phaseIndex: pi + 1, phaseCount: size.phases, phaseTitle, lessonCount: count
                })
              }
            ], { jsonMode: true, maxTokens: Math.max(1500, Math.min(4000, count * 220)), timeoutMs: 100000 })
            const wrapped = normalizeRoadmapJson(JSON.parse(content) as unknown, { goal, level, duration })?.phases?.[0]
            const valid = (wrapped?.lessons ?? [])
              .filter((l) => l.title && l.title.trim().length > 0)
              .slice(0, count)
            if (valid.length === 0) throw new Error("No usable lessons")
            console.log(`[generate] Phase ${pi + 1} ready via ${modelUsed}: ${valid.length} lessons`)
            return valid
          } catch (e) {
            // Deterministic substitute keeps the job (and roadmap) complete.
            console.error(`[generate] Phase ${pi + 1} AI failed, using template:`, getErrorMessage(e))
            return templatePhaseLessons(goal, phaseTitle, count)
          }
        })
        await step.run(`save-phase-${pi + 1}`, async () => {
          await savePhase(jobId, phaseTitle, pi, lessons)
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
        await markJobFailed(jobId, getErrorMessage(e))
      }
      console.error("[generate] Job failed:", jobId, getErrorMessage(e))
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

function generateFallbackRoadmap(goal: string, level: string, duration: string): RoadmapSpec {
  const phase1Lessons: LessonSpec[] = [
    { title: `Lesson 1: Introduction to ${goal}`, objective: `Understand the basics of ${goal} and set up your learning environment.` },
    { title: `Lesson 2: Core Concepts`, objective: `Learn the fundamental concepts and terminology of ${goal}.` },
    { title: `Lesson 3: First Steps`, objective: `Complete your first hands-on exercise in ${goal}.` },
    { title: `Lesson 4: Basic Practice`, objective: `Practice the core skills needed for ${goal}.` }
  ]
  const phase2Lessons: LessonSpec[] = [
    { title: `Lesson 5: Intermediate Concepts`, objective: `Deepen your understanding of ${goal} with intermediate topics.` },
    { title: `Lesson 6: Practical Project`, objective: `Build a small project applying ${goal} skills.` },
    { title: `Lesson 7: Best Practices`, objective: `Learn industry best practices for ${goal} development.` },
    { title: `Lesson 8: Review & Practice`, objective: `Consolidate learning with review exercises and practice problems.` }
  ]
  return {
    title: `Roadmap for ${goal}`,
    description: `A ${duration} roadmap for ${goal} at ${level} level (fallback)`,
    phases: [
      { title: "Phase 1: Foundations", lessons: phase1Lessons.map((l, i) => ({ ...l, idx: i + 1 })) },
      { title: "Phase 2: Building Skills", lessons: phase2Lessons.map((l, i) => ({ ...l, idx: i + 1 })) }
    ]
  }
}
