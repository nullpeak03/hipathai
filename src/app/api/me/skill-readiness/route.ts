import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { calculateSkillReadiness, type SkillReadinessStatus } from "@/lib/skill-readiness"

type LessonRow = { id: string; phase_id: string; idx: number; title: string }
type PhaseRow = { id: string; idx: number }
type SkillNodeRow = { id: string; lesson_id: string | null; topic: string; prerequisites: string[] | null }
type AssessmentRow = {
  lesson_id: string | null
  mode: string
  questions: unknown
  result: unknown
  score: number | null
  passed: boolean | null
  created_at: string
}
type JsonObject = Record<string, unknown>

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function statusLabel(status: SkillReadinessStatus): string {
  return {
    not_assessed: "Not assessed",
    learning: "Learning",
    practicing: "Practicing",
    demonstrated: "Demonstrated",
    needs_review: "Needs review",
  }[status]
}

async function buildReport(userId: string, roadmapId: string) {
  const supabase = createServerClient()
  const { data: roadmap, error: roadmapError } = await supabase
    .from("roadmaps")
    .select("id,title")
    .eq("id", roadmapId)
    .eq("user_id", userId)
    .maybeSingle()
  if (roadmapError) throw new Error("Could not load roadmap")
  if (!roadmap) return null

  const [
    { data: lessons, error: lessonsError },
    { data: phases, error: phasesError },
    { data: nodes, error: nodesError },
  ] = await Promise.all([
    supabase.from("lessons").select("id,phase_id,idx,title").eq("roadmap_id", roadmapId).order("idx"),
    supabase.from("phases").select("id,idx").eq("roadmap_id", roadmapId).order("idx"),
    supabase.from("skill_nodes").select("id,lesson_id,topic,prerequisites").eq("roadmap_id", roadmapId),
  ])
  if (lessonsError || phasesError || nodesError) throw new Error("Could not load roadmap skills")
  const phaseRows = (phases ?? []) as PhaseRow[]
  const phaseOrder = new Map(phaseRows.map((phase, index) => [phase.id, index]))
  const lessonRows = ((lessons ?? []) as LessonRow[]).toSorted((a, b) =>
    (phaseOrder.get(a.phase_id) ?? Number.MAX_SAFE_INTEGER) - (phaseOrder.get(b.phase_id) ?? Number.MAX_SAFE_INTEGER)
      || a.idx - b.idx
  )
  if (lessonRows.length === 0) return null
  const lessonIds = lessonRows.map((lesson) => lesson.id)
  const phaseIds = phaseRows.map((phase) => phase.id)
  const skillNodes = (nodes?.length ? nodes : lessonRows.map((lesson) => ({
    id: `lesson:${lesson.id}`,
    lesson_id: lesson.id,
    topic: lesson.title,
    prerequisites: [],
  }))) as SkillNodeRow[]

  const [
    progressResult,
    assessmentResult,
    masteryResult,
    checkResult,
    reviewResult,
    capstoneResult,
    snapshotResult,
    phaseProgressResult,
  ] = await Promise.all([
    supabase.from("progress").select("lesson_id,passed,completed,score").eq("user_id", userId).in("lesson_id", lessonIds),
    supabase.from("quiz_assessments").select("lesson_id,mode,questions,result,score,passed,created_at").eq("user_id", userId).in("lesson_id", lessonIds).not("submitted_at", "is", null).order("created_at", { ascending: false }),
    supabase.from("learner_mastery").select("lesson_id,topic,mastery_score,attempts,last_practiced_at").eq("user_id", userId).eq("roadmap_id", roadmapId),
    supabase.from("quick_check_awards").select("lesson_id,section_index,awarded_at").eq("user_id", userId).in("lesson_id", lessonIds),
    supabase.from("review_schedule").select("lesson_id,next_review_at,last_score").eq("user_id", userId).in("lesson_id", lessonIds),
    supabase.from("capstone_evidence").select("lesson_id,project_summary,repository_url,deployment_url,implementation_complete,validation_complete,documentation_complete,reflection,updated_at").eq("user_id", userId).eq("roadmap_id", roadmapId),
    supabase.from("skill_readiness_snapshots").select("snapshot,completed_at").eq("user_id", userId).eq("roadmap_id", roadmapId).maybeSingle(),
    supabase.from("phase_exam_progress").select("phase_id,passed").eq("user_id", userId).in("phase_id", phaseIds),
  ])
  const queryError = progressResult.error || assessmentResult.error || masteryResult.error || checkResult.error || reviewResult.error || capstoneResult.error || snapshotResult.error || phaseProgressResult.error
  if (queryError) throw new Error("Could not load skill evidence")

  const progressRows = progressResult.data ?? []
  const assessmentRows = (assessmentResult.data ?? []) as AssessmentRow[]
  const masteryRows = masteryResult.data ?? []
  const checkRows = checkResult.data ?? []
  const reviewRows = reviewResult.data ?? []
  const capstoneRows = capstoneResult.data ?? []
  const today = new Date().toISOString().slice(0, 10)
  const firstUnpassed = lessonRows.find((lesson) => !progressRows.some((row) => row.lesson_id === lesson.id && row.passed))
  const passedPhaseIds = new Set((phaseProgressResult.data ?? []).filter((row) => row.passed).map((row) => row.phase_id))
  const firstUnpassedPhaseIndex = firstUnpassed ? phaseOrder.get(firstUnpassed.phase_id) ?? 0 : 0
  const firstUnpassedPhaseUnlocked = phaseRows
    .slice(0, firstUnpassedPhaseIndex)
    .every((phase) => passedPhaseIds.has(phase.id))

  const skills = skillNodes.map((node) => {
    const lesson = lessonRows.find((row) => row.id === node.lesson_id)
    const attempts = assessmentRows
      .filter((row) => row.lesson_id === node.lesson_id && row.mode !== "challenge" && row.score !== null)
      .map((row) => ({ score: Number(row.score), createdAt: row.created_at }))
    const checks = checkRows.filter((row) => row.lesson_id === node.lesson_id)
    const capstone = capstoneRows.find((row) => row.lesson_id === node.lesson_id)
    const review = reviewRows.find((row) => row.lesson_id === node.lesson_id)
    const readiness = calculateSkillReadiness({
      quizAttempts: attempts,
      successfulQuickChecks: checks.length,
      capstoneReported: !!capstone,
      lessonIsCurrent: lesson?.id === firstUnpassed?.id && firstUnpassedPhaseUnlocked,
      reviewOverdue: typeof review?.next_review_at === "string" && review.next_review_at < today,
    })
    const evidence = [
      ...assessmentRows
        .filter((row) => row.lesson_id === node.lesson_id && row.mode !== "challenge" && row.score !== null)
        .map((row, index) => {
          const results = asArray(asObject(row.result)?.results)
          const correct = results.filter((item) => asObject(item)?.correct === true).length
          return {
            id: `quiz:${node.lesson_id}:${row.created_at}:${index}`,
            type: "quiz",
            label: `${row.mode === "remedial" ? "Practice quiz" : "Lesson quiz"} · ${row.score}%`,
            occurredAt: row.created_at,
            score: Number(row.score),
            correctQuestions: results.length ? correct : null,
            questionCount: results.length || asArray(row.questions).length,
            verified: true,
            href: lesson ? `/roadmap/${roadmapId}/lesson/${lesson.id}` : `/roadmap/${roadmapId}`,
          }
        }),
      ...checks.map((row) => ({
        id: `check:${node.lesson_id}:${row.section_index}`,
        type: "quick_check",
        label: "Quick check passed",
        occurredAt: row.awarded_at,
        score: 100,
        verified: true,
        href: lesson ? `/roadmap/${roadmapId}/lesson/${lesson.id}` : `/roadmap/${roadmapId}`,
      })),
      ...(capstone ? [{
        id: `capstone:${node.lesson_id}`,
        type: "capstone",
        label: "Capstone evidence · learner-reported",
        occurredAt: capstone.updated_at,
        score: null,
        verified: false,
        detail: capstone.project_summary || capstone.reflection || "Self-reported checklist or project links saved.",
        href: lesson ? `/roadmap/${roadmapId}/lesson/${lesson.id}` : `/roadmap/${roadmapId}`,
      }] : []),
    ].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, 12)

    return {
      topic: node.topic,
      lessonId: node.lesson_id,
      lessonTitle: lesson?.title ?? node.topic,
      status: readiness.status,
      statusLabel: statusLabel(readiness.status),
      score: readiness.score,
      explanation: readiness.explanation,
      successfulQuickChecks: checks.length,
      masteryScore: Number(masteryRows.find((row) => row.lesson_id === node.lesson_id)?.mastery_score ?? 0),
      evidence,
      nextStep: readiness.status === "needs_review"
        ? "Revisit this lesson and complete its scheduled review."
        : readiness.status === "practicing"
          ? "Review the lesson, complete a quick check, then try a fresh quiz."
          : readiness.status === "learning"
            ? "Complete this lesson and its quick checks to start building evidence."
            : readiness.status === "not_assessed"
              ? "Reach this skill in your roadmap to begin collecting evidence."
              : "Keep the skill fresh with spaced review and later project work.",
    }
  })
  const allLessonsPassed = lessonRows.every((lesson) => progressRows.some((row) => row.lesson_id === lesson.id && row.passed))
  const allPhasesPassed = phaseIds.every((phaseId) => passedPhaseIds.has(phaseId))
  const totalQuizAttempts = assessmentRows.filter((row) => row.mode !== "challenge" && row.score !== null)
  const passedQuizAttempts = totalQuizAttempts.filter((row) => row.passed === true).length
  const masteryValues = masteryRows.map((row) => Number(row.mastery_score)).filter(Number.isFinite)
  const snapshot = asObject(snapshotResult.data?.snapshot)

  return {
    roadmap: { id: roadmap.id, title: roadmap.title },
    roadmapCompleted: allLessonsPassed && allPhasesPassed,
    completionRequirements: { lessonsPassed: allLessonsPassed, phaseExamsPassed: allPhasesPassed },
    completedLessons: progressRows.filter((row) => row.passed).length,
    totalLessons: lessonRows.length,
    passRate: totalQuizAttempts.length ? Math.round(100 * passedQuizAttempts / totalQuizAttempts.length) : 0,
    averageMastery: masteryValues.length ? Math.round(masteryValues.reduce((sum, value) => sum + value, 0) / masteryValues.length) : 0,
    skills,
    snapshot: snapshot ? { data: snapshot, completedAt: snapshotResult.data?.completed_at ?? null } : null,
  }
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const roadmapId = req.nextUrl.searchParams.get("roadmapId")
  if (!roadmapId) return NextResponse.json({ error: "Missing roadmapId" }, { status: 400 })
  try {
    const report = await buildReport(userId, roadmapId)
    if (!report) return NextResponse.json({ error: "Roadmap not found" }, { status: 404 })
    return NextResponse.json({ report })
  } catch (error) {
    console.error("[skill-readiness] Failed to build report:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Could not load skill readiness" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => null) as { roadmapId?: unknown } | null
  if (typeof body?.roadmapId !== "string") return NextResponse.json({ error: "Missing roadmapId" }, { status: 400 })
  try {
    const report = await buildReport(userId, body.roadmapId)
    if (!report) return NextResponse.json({ error: "Roadmap not found" }, { status: 404 })
    if (!report.roadmapCompleted) return NextResponse.json({ error: "Complete all roadmap lessons before finalizing readiness" }, { status: 409 })
    const supabase = createServerClient()
    const { error } = await supabase.from("skill_readiness_snapshots").upsert({
      user_id: userId,
      roadmap_id: body.roadmapId,
      snapshot: { ...report, snapshot: undefined },
    }, { onConflict: "user_id,roadmap_id", ignoreDuplicates: true })
    if (error) throw new Error("Could not save the completion snapshot")
    const saved = await buildReport(userId, body.roadmapId)
    if (!saved?.snapshot) throw new Error("Completion snapshot was not returned")
    return NextResponse.json({ report: saved })
  } catch (error) {
    console.error("[skill-readiness] Failed to finalize report:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Could not finalize skill readiness" }, { status: 500 })
  }
}
