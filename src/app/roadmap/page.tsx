"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, Clock3, LayoutGrid, List, Loader2, Map as MapIcon, RefreshCw, Trophy } from "lucide-react"

import { Header } from "@/components/layout/Header"
import { Sidebar } from "@/components/layout/Sidebar"
import { PageTransition } from "@/components/motion/page-transition"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { useToast } from "@/components/ui/toast"
import { AdaptationHistory, PendingAdaptations } from "@/components/roadmap/roadmap-adaptations"
import { RoadmapActionsMenu } from "@/components/roadmap/roadmap-actions-menu"
import { JourneyStrip, type JourneyPhase } from "@/components/roadmap/journey-strip"
import { MobileContinueBar, type MobileContinueCta } from "@/components/roadmap/mobile-continue-bar"
import { PhaseCard } from "@/components/roadmap/phase-card"
import type { PhaseExamState } from "@/components/roadmap/phase-exam-dialog"
import { RoadmapHero, type HeroNextStep } from "@/components/roadmap/roadmap-hero"
import { SkillsReadinessSection } from "@/components/roadmap/skills-readiness-section"
import {
  countPassedLessons,
  estimateRemainingMinutes,
  findNextLesson,
  formatDuration,
  getCheckpointStatus,
  getFocusPhaseIndex,
  isLessonLocked as isLessonLockedIn,
  isPhaseCheckpointOpen,
  isPhaseComplete,
  phaseLessonsPassed,
  remainingSummaryLabel,
} from "@/lib/roadmap-progress"
import type { IssuedAssessment, PublicQuizQuestion } from "@/lib/assessment"
import type { Lesson } from "@/lib/mockData"
import {
  clearRoadmap,
  createReplanProposal,
  loadGam,
  loadGamAsync,
  loadMasteryAsync,
  loadPhaseProgress,
  loadProgress,
  loadProgressAsync,
  loadReplanHistory,
  loadRoadmap,
  loadRoadmapAsync,
  loadSkillGraphAsync,
  remoteFetchFailureCount,
  submitAssessmentRequest,
  syncSkillGraph,
  updateReplanProposal,
  type PhaseProgress,
  type Progress,
  type ReplanProposalRecord,
  type RoadmapData,
  type RoadmapRevisionRecord,
} from "@/lib/store"
import { cn } from "@/lib/utils"

const EXAM_DRAFT_KEY = "hipath_phase_exam_drafts"
const EXAM_FALLBACK_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * The checkpoint dialog pulls in quiz rendering and form code that the page
 * does not need until a learner opens it. It is rendered only while open, so
 * the chunk loads on demand instead of with the roadmap.
 */
const PhaseExamDialog = dynamic(
  () => import("@/components/roadmap/phase-exam-dialog").then((mod) => mod.PhaseExamDialog),
  { ssr: false }
)

type StoredExamDraft = {
  assessmentId: string
  quiz: PublicQuizQuestion[]
  answers: Record<number, number>
  expiresAt: number
}

/**
 * Unsubmitted checkpoint drafts are kept on this device so a reload does not
 * lose selections. Anything past its server expiry (24h) is discarded.
 */
function readExamDrafts(): Record<string, StoredExamDraft> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(EXAM_DRAFT_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, StoredExamDraft>
    const now = Date.now()
    const valid: Record<string, StoredExamDraft> = {}
    for (const [phaseId, draft] of Object.entries(parsed)) {
      if (
        draft &&
        typeof draft.assessmentId === "string" &&
        Array.isArray(draft.quiz) &&
        typeof draft.expiresAt === "number" &&
        draft.expiresAt > now
      ) {
        valid[phaseId] = draft
      }
    }
    return valid
  } catch {
    return {}
  }
}

export default function RoadmapPage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const toast = useToast()

  const [roadmap, setRoadmap] = useState<RoadmapData | null | undefined>(undefined)
  const [progress, setProgress] = useState<Progress>({})
  const [gam, setGam] = useState({ streak: 0 })
  const [mounted, setMounted] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({})
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [phaseExams, setPhaseExams] = useState<Record<string, PhaseExamState>>({})
  const [phaseExamLoading, setPhaseExamLoading] = useState<Record<string, boolean>>({})
  const [phaseExamSubmitting, setPhaseExamSubmitting] = useState<Record<string, boolean>>({})
  const [examPhaseId, setExamPhaseId] = useState<string | null>(null)
  const [phaseProgress, setPhaseProgress] = useState<PhaseProgress>({})
  const [skillNodes, setSkillNodes] = useState<{ topic: string; mastery?: number }[]>([])
  const [skillsOpenSignal, setSkillsOpenSignal] = useState(0)
  const [replanProposals, setReplanProposals] = useState<ReplanProposalRecord[]>([])
  const [replanRevisions, setReplanRevisions] = useState<RoadmapRevisionRecord[]>([])
  const [replanBusy, setReplanBusy] = useState(false)
  const [publishBusy, setPublishBusy] = useState(false)
  const [failedGenerationJobs, setFailedGenerationJobs] = useState<Record<string, string[]>>({})
  const [previewRoadmapId, setPreviewRoadmapId] = useState<string | null>(null)
  const [phaseExamError, setPhaseExamError] = useState<Record<string, string>>({})
  const [syncFailed, setSyncFailed] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncAttempt, setSyncAttempt] = useState(0)
  const examRequestsRef = useRef<Set<string>>(new Set())
  const deepLinkRef = useRef<string | null>(null)

  const handlePhaseExam = async (phaseId: string) => {
    if (examRequestsRef.current.has(phaseId)) return
    examRequestsRef.current.add(phaseId)
    setPhaseExamLoading((prev) => ({ ...prev, [phaseId]: true }))
    setPhaseExamError((prev) => {
      if (!(phaseId in prev)) return prev
      const next = { ...prev }
      delete next[phaseId]
      return next
    })
    try {
      const res = await fetch("/api/phases/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phaseId }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(
          res.status === 429
            ? body.error || "Too many checkpoint requests. Wait a moment and try again."
            : body.error || "Could not generate a phase quiz."
        )
      }
      const issued = (await res.json()) as IssuedAssessment
      if (!issued.assessmentId || !issued.quiz?.length) throw new Error("Invalid checkpoint")
      const parsedExpiry = issued.expiresAt ? Date.parse(issued.expiresAt) : NaN
      const expiresAt = Number.isFinite(parsedExpiry) ? parsedExpiry : Date.now() + EXAM_FALLBACK_WINDOW_MS
      setPhaseExams((prev) => ({
        ...prev,
        [phaseId]: {
          assessmentId: issued.assessmentId,
          quiz: issued.quiz,
          answers: {},
          submitted: false,
          score: 0,
          passed: false,
          expiresAt,
        },
      }))
      setExamPhaseId(phaseId)
    } catch (error) {
      toast({
        title: "Phase quiz unavailable",
        message: error instanceof Error ? error.message : "Could not generate a phase quiz. Try again.",
        kind: "error",
      })
    } finally {
      examRequestsRef.current.delete(phaseId)
      setPhaseExamLoading((prev) => ({ ...prev, [phaseId]: false }))
    }
  }

  const submitPhaseExam = async (phaseId: string) => {
    const exam = phaseExams[phaseId]
    if (!exam || exam.submitted || phaseExamSubmitting[phaseId]) return
    setPhaseExamSubmitting((prev) => ({ ...prev, [phaseId]: true }))
    const submission = await submitAssessmentRequest(exam.assessmentId, exam.answers)
    setPhaseExamSubmitting((prev) => ({ ...prev, [phaseId]: false }))
    if (!submission.ok) {
      if (submission.status === 410) {
        // The 24h window elapsed. Drop the dead draft and let the learner
        // start a fresh checkpoint from the card.
        setPhaseExams((prev) => {
          const next = { ...prev }
          delete next[phaseId]
          return next
        })
        setExamPhaseId((current) => (current === phaseId ? null : current))
        setPhaseExamError((prev) => {
          const next = { ...prev }
          delete next[phaseId]
          return next
        })
        toast({
          title: "Checkpoint expired",
          message: "Checkpoints expire after 24 hours. Start a new attempt to continue.",
          kind: "info",
        })
      } else {
        setPhaseExamError((prev) => ({ ...prev, [phaseId]: submission.error }))
      }
      return
    }
    const result = submission.result
    setPhaseExamError((prev) => {
      if (!(phaseId in prev)) return prev
      const next = { ...prev }
      delete next[phaseId]
      return next
    })
    setPhaseExams((prev) => {
      const current = prev[phaseId]
      if (!current) return prev
      return {
        ...prev,
        [phaseId]: {
          ...current,
          submitted: true,
          score: result.score,
          passed: result.passed,
          results: result.results,
        },
      }
    })
    setPhaseProgress((prev) => {
      const prior = prev[phaseId]
      const alreadyPassed = prior?.passed === true
      return {
        ...prev,
        [phaseId]: {
          // A practice retake must never revoke an earned pass. A better
          // passing score can still replace the stored one.
          passed: alreadyPassed || result.passed,
          score: alreadyPassed
            ? result.passed
              ? Math.max(prior?.score ?? 0, result.score)
              : prior?.score ?? null
            : result.score,
          attempts: alreadyPassed ? prior?.attempts ?? 0 : (prior?.attempts ?? 0) + 1,
        },
      }
    })
  }

  const selectExamAnswer = (phaseId: string, questionIndex: number, optionIndex: number) => {
    setPhaseExams((prev) => {
      const exam = prev[phaseId]
      if (!exam || exam.submitted) return prev
      return {
        ...prev,
        [phaseId]: {
          ...exam,
          answers: { ...exam.answers, [questionIndex]: optionIndex },
        },
      }
    })
  }

  const startNewExamAttempt = (phaseId: string) => {
    setPhaseExams((prev) => {
      const next = { ...prev }
      delete next[phaseId]
      return next
    })
    setPhaseExamError((prev) => {
      const next = { ...prev }
      delete next[phaseId]
      return next
    })
    setExamPhaseId(null)
    void handlePhaseExam(phaseId)
  }

  /** Open an existing draft/result, dropping it first if it has expired. */
  const openExam = useCallback(
    (phaseId: string) => {
      const exam = phaseExams[phaseId]
      if (!exam) return
      if (exam.submitted) {
        setExamPhaseId(phaseId)
        return
      }
      if (exam.expiresAt <= Date.now()) {
        setPhaseExams((prev) => {
          const next = { ...prev }
          delete next[phaseId]
          return next
        })
        setExamPhaseId((current) => (current === phaseId ? null : current))
        toast({
          title: "Checkpoint expired",
          message: "Checkpoints expire after 24 hours. Start a new attempt to continue.",
          kind: "info",
        })
        return
      }
      setExamPhaseId(phaseId)
    },
    [phaseExams, toast]
  )

  const closeExam = useCallback(() => setExamPhaseId(null), [])

  useEffect(() => {
    setMounted(true)
    setRoadmap(loadRoadmap())
    setPreviewRoadmapId(localStorage.getItem("hipath_roadmap_preview"))
    setProgress(loadProgress())
    setGam(loadGam())
    const storedView = localStorage.getItem("hipath_viewMode") as "grid" | "list" | null
    if (storedView) setViewMode(storedView)

    const drafts = readExamDrafts()
    if (Object.keys(drafts).length > 0) {
      setPhaseExams((previous) => {
        const next = { ...previous }
        for (const [phaseId, draft] of Object.entries(drafts)) {
          if (next[phaseId]) continue
          next[phaseId] = {
            assessmentId: draft.assessmentId,
            quiz: draft.quiz,
            answers: draft.answers ?? {},
            submitted: false,
            score: 0,
            passed: false,
            expiresAt: draft.expiresAt,
          }
        }
        return next
      })
    }
  }, [])

  // Reconcile with Supabase (source of truth; helpers degrade to cache).
  // Each slice settles independently so one failed call cannot discard the
  // others, and failures surface a retryable banner instead of vanishing.
  useEffect(() => {
    if (!isLoaded) return
    let cancelled = false
    void (async () => {
      setSyncing(true)
      const failuresBefore = remoteFetchFailureCount()
      const [roadmapResult, gamResult, progressResult, phaseResult, masteryResult] = await Promise.allSettled([
        loadRoadmapAsync(),
        loadGamAsync(),
        loadProgressAsync(),
        loadPhaseProgress(),
        loadMasteryAsync(),
      ])
      if (cancelled) return

      let failed = remoteFetchFailureCount() > failuresBefore
      const mastery = masteryResult.status === "fulfilled" ? masteryResult.value : []
      if (masteryResult.status === "rejected") failed = true

      if (gamResult.status === "fulfilled") setGam(gamResult.value)
      else failed = true

      if (progressResult.status === "fulfilled" && Object.keys(progressResult.value).length) {
        setProgress(progressResult.value)
      } else if (progressResult.status === "rejected") failed = true

      if (phaseResult.status === "fulfilled") setPhaseProgress(phaseResult.value)
      else failed = true

      const remoteRoadmap = roadmapResult.status === "fulfilled" ? roadmapResult.value : null
      if (roadmapResult.status === "rejected") failed = true

      if (remoteRoadmap) {
        setRoadmap(remoteRoadmap)
        const nodes = remoteRoadmap.phases.flatMap((phase) =>
          phase.lessons.map((lesson) => ({
            roadmap_id: remoteRoadmap.id,
            lesson_id: lesson.id,
            topic: lesson.title,
            difficulty: null,
            prerequisites: lesson.prerequisites ?? [],
          }))
        )
        const skillTask = (async () => {
          await syncSkillGraph(remoteRoadmap.id, nodes)
          let graph = await loadSkillGraphAsync(remoteRoadmap.id)
          if (!graph || graph.length === 0) graph = nodes
          const masteryMap = new Map(mastery.map((record) => [record.topic, record.mastery_score]))
          setSkillNodes(graph.map((node) => ({ topic: node.topic, mastery: masteryMap.get(node.topic) })))
        })()
        const historyTask = loadReplanHistory(remoteRoadmap.id).then(({ proposals, revisions }) => {
          setReplanProposals(proposals)
          setReplanRevisions(revisions)
        })
        const [skillResult, historyResult] = await Promise.allSettled([skillTask, historyTask])
        if (skillResult.status === "rejected" || historyResult.status === "rejected") failed = true
      }

      if (cancelled) return
      // Include any write failures (e.g. skill-graph sync) that happened
      // during this pass.
      failed = failed || remoteFetchFailureCount() > failuresBefore
      setSyncFailed(failed)
      setSyncing(false)
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, isLoaded, syncAttempt])

  useEffect(() => {
    if (mounted) localStorage.setItem("hipath_viewMode", viewMode)
  }, [viewMode, mounted])

  // Phase deep links: /roadmap#phase-<id> opens and scrolls to that phase.
  // Declared before the loading guards below so hook order stays stable.
  useEffect(() => {
    if (!roadmap) return

    const revealFromHash = (smooth: boolean) => {
      const match = window.location.hash.match(/^#phase-(.+)$/)
      if (!match) return
      let phaseId: string
      try {
        phaseId = decodeURIComponent(match[1])
      } catch {
        return
      }
      if (!roadmap.phases.some((phase) => phase.id === phaseId)) return
      if (deepLinkRef.current === phaseId) return
      deepLinkRef.current = phaseId
      setOpenPhases((prev) => ({ ...prev, [phaseId]: true }))
      requestAnimationFrame(() => {
        document.getElementById(`phase-${phaseId}`)?.scrollIntoView({
          behavior: smooth ? "smooth" : "auto",
          block: "start",
        })
      })
    }

    revealFromHash(false)
    const onHashChange = () => {
      deepLinkRef.current = null
      revealFromHash(true)
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [roadmap])

  // Persist unsubmitted checkpoint drafts so a reload keeps selections.
  useEffect(() => {
    if (!mounted) return
    const drafts: Record<string, StoredExamDraft> = {}
    const now = Date.now()
    for (const [phaseId, exam] of Object.entries(phaseExams)) {
      if (exam.submitted || exam.expiresAt <= now) continue
      drafts[phaseId] = {
        assessmentId: exam.assessmentId,
        quiz: exam.quiz,
        answers: exam.answers,
        expiresAt: exam.expiresAt,
      }
    }
    try {
      if (Object.keys(drafts).length > 0) localStorage.setItem(EXAM_DRAFT_KEY, JSON.stringify(drafts))
      else localStorage.removeItem(EXAM_DRAFT_KEY)
    } catch {
      // localStorage can be unavailable (private mode/quota); drafts then
      // simply live for the current session.
    }
  }, [phaseExams, mounted])

  if (!mounted || roadmap === undefined) {
    return (
      <div className="flex min-h-screen bg-app">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="mx-auto w-full max-w-7xl p-4 sm:p-6">
            <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading roadmap">
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="h-8 w-1/2 rounded bg-muted" />
              <div className="h-4 w-2/3 rounded bg-muted" />
              <div className="h-64 rounded-2xl bg-muted" />
              <div className="h-24 rounded-2xl bg-muted" />
              <div className="h-20 rounded-2xl bg-muted" />
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (roadmap === null) {
    return (
      <div className="flex min-h-screen bg-app">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="mx-auto w-full max-w-3xl p-4 py-10 sm:p-6">
            <PageTransition>
              <Card className="p-6 sm:p-8">
                <EmptyState
                  icon={MapIcon}
                  title="No roadmap yet"
                  description="Tell HiPath your goal, level, and time. We'll build a structured, adaptive plan with lessons and phase checkpoints."
                  action={
                    <Button asChild>
                      <Link href="/onboarding">Create your roadmap</Link>
                    </Button>
                  }
                />
                <div className="mt-6 grid gap-2 border-t border-border pt-5 text-center sm:grid-cols-3">
                  {["Personalized phases", "Adaptive checkpoints", "Progress tracking"].map((label) => (
                    <div key={label} className="rounded-xl bg-app/60 px-3 py-2.5 text-xs font-medium text-muted-foreground">
                      {label}
                    </div>
                  ))}
                </div>
              </Card>
            </PageTransition>
          </main>
        </div>
      </div>
    )
  }

  const allLessons = roadmap.phases.flatMap((phase) => phase.lessons)
  const total = allLessons.length || roadmap.totalLessons
  const passed = countPassedLessons(roadmap.phases, progress)
  const pct = total > 0 ? Math.min(100, Math.round((passed / total) * 100)) : 0
  const remaining = Math.max(0, total - passed)
  const timeLeft = formatDuration(estimateRemainingMinutes(roadmap.phases, progress))
  const rawFocusPhaseIndex = getFocusPhaseIndex(roadmap.phases, progress, phaseProgress)
  // A phase with no lessons cannot be studied or checkpointed, so it must not
  // become the focus phase or count toward checkpoint completion.
  const lessonPhaseIndexes = roadmap.phases.flatMap((phase, index) =>
    phase.lessons.length > 0 ? [index] : []
  )
  const fallbackFocusIndex =
    lessonPhaseIndexes.find((index) => !phaseProgress[roadmap.phases[index].id]?.passed) ??
    lessonPhaseIndexes[0] ??
    -1
  const focusPhaseIndex =
    rawFocusPhaseIndex >= 0 && roadmap.phases[rawFocusPhaseIndex].lessons.length > 0
      ? rawFocusPhaseIndex
      : fallbackFocusIndex
  const focusPhase = focusPhaseIndex >= 0 ? roadmap.phases[focusPhaseIndex] : null
  const checkpointsPassed = lessonPhaseIndexes.filter(
    (index) => phaseProgress[roadmap.phases[index].id]?.passed === true
  ).length
  const nextLesson = findNextLesson(roadmap.phases, progress)
  const roadmapComplete =
    nextLesson === null && lessonPhaseIndexes.length > 0 && checkpointsPassed === lessonPhaseIndexes.length
  // Never show "≈ 0 min left" while checkpoints still gate completion.
  const checkpointsRemaining = Math.max(0, lessonPhaseIndexes.length - checkpointsPassed)
  const timeChipLabel = remainingSummaryLabel({
    complete: roadmapComplete,
    remainingLessons: remaining,
    remainingCheckpoints: checkpointsRemaining,
    timeLeft,
  })
  const showRoadmapPreview = previewRoadmapId === roadmap.id
  const hasPendingAdaptations = replanProposals.some((proposal) => proposal.status === "pending")
  const hasAdaptationWork = hasPendingAdaptations || Object.keys(failedGenerationJobs).length > 0

  const journey: JourneyPhase[] = roadmap.phases.map((phase, index) => {
    // Completion always requires the checkpoint pass. The two-attempt remedial
    // unlock only lets lessons continue, so those phases get an "open" state.
    const done = isPhaseComplete(phase, progress, phaseProgress)
    const checkpointOpen = isPhaseCheckpointOpen(phase, progress, phaseProgress)
    const state: JourneyPhase["state"] = done
      ? "done"
      : index === focusPhaseIndex
        ? "current"
        : checkpointOpen
          ? "open"
          : "todo"
    return {
      id: phase.id,
      title: phase.title,
      state,
      done: phaseLessonsPassed(phase, progress),
      total: phase.lessons.length,
    }
  })

  const heroCurrentPhase = focusPhase
    ? {
        index: focusPhaseIndex,
        total: roadmap.phases.length,
        title: focusPhase.title,
        passed: phaseLessonsPassed(focusPhase, progress),
        lessons: focusPhase.lessons.length,
        checkpoint: getCheckpointStatus(focusPhase, progress, phaseProgress),
        checkpointScore: phaseProgress[focusPhase.id]?.score ?? null,
        isLast: focusPhaseIndex === roadmap.phases.length - 1,
      }
    : null

  const scrollToPhases = () => {
    document.getElementById("phases-heading")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const openPhase = (phaseId: string) => {
    setOpenPhases((prev) => ({ ...prev, [phaseId]: true }))
    // Keep the address bar shareable without triggering a Next.js navigation.
    const hash = `#phase-${encodeURIComponent(phaseId)}`
    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`)
    }
    requestAnimationFrame(() => {
      document.getElementById(`phase-${phaseId}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  const startOrResumeCheckpoint = (phaseId: string) => {
    openPhase(phaseId)
    const exam = phaseExams[phaseId]
    if (exam && (exam.submitted || exam.expiresAt > Date.now())) {
      openExam(phaseId)
      return
    }
    if (exam) {
      setPhaseExams((prev) => {
        const next = { ...prev }
        delete next[phaseId]
        return next
      })
      toast({
        title: "Checkpoint expired",
        message: "That checkpoint expired after 24 hours. Generating a fresh one.",
        kind: "info",
      })
    }
    void handlePhaseExam(phaseId)
  }

  const scrollToSkills = () => {
    setSkillsOpenSignal((value) => value + 1)
    requestAnimationFrame(() => {
      document.getElementById("skills-readiness")?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  let heroNext: HeroNextStep
  if (nextLesson) {
    const locked = isLessonLockedIn(
      roadmap.phases,
      nextLesson.phaseIndex,
      nextLesson.lessonIndex,
      progress,
      phaseProgress
    )
    const phase = roadmap.phases[nextLesson.phaseIndex]
    const lesson = nextLesson.lesson
    const lessonTitle = lesson.title ?? "Next lesson"

    if (locked) {
      const checkpointPhase = focusPhase ?? phase
      const checkpointIndex = roadmap.phases.findIndex((item) => item.id === checkpointPhase.id)
      heroNext = {
        kind: "checkpoint",
        label: "Checkpoint needed",
        title: `Phase ${checkpointIndex + 1}: ${checkpointPhase.title}`,
        detail: `Pass the phase checkpoint to unlock ${lessonTitle}.`,
        phaseId: checkpointPhase.id,
        onStart: () => {
          startOrResumeCheckpoint(checkpointPhase.id)
        },
      }
    } else {
      heroNext = {
        kind: "lesson",
        label: progress[lesson.id]?.completed === true ? "Continue lesson" : "Up next",
        title: lessonTitle,
        detail: `Phase ${nextLesson.phaseIndex + 1} · ${phase.title}${
          lesson.estimatedMinutes ? ` · about ${lesson.estimatedMinutes} min` : ""
        }`,
        href: `/roadmap/${roadmap.id}/lesson/${lesson.id}`,
      }
    }
  } else {
    const checkpointPhaseIndex = roadmap.phases.findIndex(
      (phase) => phase.lessons.length > 0 && !phaseProgress[phase.id]?.passed
    )
    if (checkpointPhaseIndex >= 0) {
      const phase = roadmap.phases[checkpointPhaseIndex]
      heroNext = {
        kind: "checkpoint",
        label: "Checkpoint needed",
        title: `Phase ${checkpointPhaseIndex + 1}: ${phase.title}`,
        detail: "All lessons are passed. Complete the phase checkpoint to finish the roadmap.",
        phaseId: phase.id,
        onStart: () => {
          startOrResumeCheckpoint(phase.id)
        },
      }
    } else if (lessonPhaseIndexes.length === 0) {
      heroNext = {
        kind: "complete",
        label: "No lessons yet",
        title: "This roadmap has no lessons yet",
        detail: "Lessons may still be generating. View the phases to check, or re-plan the roadmap.",
        actionLabel: "View phases",
        onReview: scrollToPhases,
      }
    } else {
      heroNext = {
        kind: "complete",
        label: "Roadmap complete",
        title: "Every lesson and checkpoint is passed",
        detail: "Review your skills and readiness evidence, or revisit any lesson.",
        onReview: scrollToSkills,
      }
    }
  }

  // Mirror the hero's own label so a resumed lesson doesn't read "Up next".
  const mobileLabel = heroNext.label
  const mobileEmpty = heroNext.kind === "complete" && lessonPhaseIndexes.length === 0
  const mobileTitle =
    heroNext.kind === "complete"
      ? mobileEmpty
        ? heroNext.title
        : "Review your skills & readiness"
      : heroNext.title
  const mobileDetail =
    heroNext.kind === "complete"
      ? mobileEmpty
        ? heroNext.detail
        : "All lessons and checkpoints passed."
      : heroNext.kind === "checkpoint"
        ? undefined
        : heroNext.detail
  const mobileCta: MobileContinueCta =
    heroNext.kind === "lesson"
      ? { label: "Continue", href: heroNext.href }
      : heroNext.kind === "checkpoint"
        ? { label: "Checkpoint", onClick: heroNext.onStart }
        : { label: mobileEmpty ? "Phases" : "Review", onClick: heroNext.onReview }

  const checkpointBusy = heroNext.kind === "checkpoint" ? Boolean(phaseExamLoading[heroNext.phaseId]) : false

  const activeExamPhase = examPhaseId ? roadmap.phases.find((phase) => phase.id === examPhaseId) ?? null : null
  const activeExam = examPhaseId ? phaseExams[examPhaseId] ?? null : null
  const examDialogOpen = Boolean(activeExam && activeExamPhase)
  const activeExamIndex = activeExamPhase
    ? roadmap.phases.findIndex((phase) => phase.id === activeExamPhase.id)
    : 0
  const activeExamError = examPhaseId ? phaseExamError[examPhaseId] ?? null : null

  const handleDelete = async () => {
    if (!roadmap) return
    setConfirmDelete(false)
    setDeleting(true)
    try {
      const res = await fetch(`/api/me/roadmaps/${roadmap.id}`, { method: "DELETE" })
      if (!res.ok) {
        toast({ title: "Delete failed", message: "Could not delete the roadmap on the server. Check your connection and try again.", kind: "error" })
        return
      }
    } catch {
      toast({ title: "Delete failed", message: "Could not delete the roadmap on the server. Check your connection and try again.", kind: "error" })
      return
    } finally {
      setDeleting(false)
    }
    clearRoadmap()
    localStorage.removeItem("hipath_progress")
    localStorage.removeItem("hipath_onboarding_draft")
    localStorage.removeItem("hipath_roadmap_preview")
    localStorage.removeItem(EXAM_DRAFT_KEY)
    setRoadmap(null)
    router.push("/onboarding")
  }

  const handleEdit = () => {
    router.push(`/onboarding?edit=${roadmap.id}`)
  }

  const requestPublish = async () => {
    if (!roadmap || publishBusy) return
    setPublishBusy(true)
    try {
      const res = await fetch("/api/me/review-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roadmapId: roadmap.id, reason: "User requested publish" }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || "Could not submit your publish request.")
      }
      toast({
        title: "Publish request sent",
        message: "An admin will review your roadmap before it appears in the public library.",
        kind: "success",
      })
    } catch (error) {
      toast({
        title: "Publish request failed",
        message: error instanceof Error ? error.message : "Check your connection and try again.",
        kind: "error",
      })
    } finally {
      setPublishBusy(false)
    }
  }

  const refreshReplanHistory = async () => {
    const history = await loadReplanHistory(roadmap.id)
    setReplanProposals(history.proposals)
    setReplanRevisions(history.revisions)
  }

  const requestReplanProposal = async () => {
    if (replanBusy) return
    setReplanBusy(true)
    const created = await createReplanProposal(roadmap.id)
    if (!created) {
      toast({
        title: "No adaptation proposal created",
        message: "There may be no repeated weak topics in this roadmap yet. Try again after another quiz attempt.",
        kind: "error",
      })
    } else {
      await refreshReplanHistory()
      toast({ title: "Proposal ready", message: "Review the suggested roadmap changes before applying them.", kind: "success" })
    }
    setReplanBusy(false)
  }

  const decideReplanProposal = async (proposal: ReplanProposalRecord, status: "approved" | "rejected") => {
    if (replanBusy) return
    setReplanBusy(true)
    const result = await updateReplanProposal(roadmap.id, proposal.id, status)
    await refreshReplanHistory()
    if (!result.ok) {
      toast({ title: "Could not update proposal", message: "Refresh the roadmap and try again.", kind: "error" })
    } else if (status === "approved") {
      const updatedRoadmap = await loadRoadmapAsync()
      if (updatedRoadmap) {
        setRoadmap(updatedRoadmap)
        const mastery = await loadMasteryAsync()
        const nodes = updatedRoadmap.phases.flatMap((phase) =>
          phase.lessons.map((lesson) => ({
            roadmap_id: updatedRoadmap.id,
            lesson_id: lesson.id,
            topic: lesson.title,
            difficulty: null,
            prerequisites: lesson.prerequisites ?? [],
          }))
        )
        await syncSkillGraph(updatedRoadmap.id, nodes)
        let graph = await loadSkillGraphAsync(updatedRoadmap.id)
        if (!graph || graph.length === 0) graph = nodes
        const masteryMap = new Map(mastery.map((record) => [record.topic, record.mastery_score]))
        setSkillNodes(graph.map((node) => ({ topic: node.topic, mastery: masteryMap.get(node.topic) })))
      }
      toast({
        title: "Roadmap updated",
        message:
          (result.failedJobIds?.length ?? 0) > 0
            ? "The change was applied, but some lessons need generation retries. Use the retry action below."
            : "Focused practice was added for the selected weak topics.",
        kind: result.generationQueued === false ? "error" : "success",
      })
      if (result.failedJobIds?.length) {
        setFailedGenerationJobs((previous) => ({ ...previous, [proposal.id]: result.failedJobIds ?? [] }))
      }
    } else {
      toast({ title: "Proposal dismissed", message: "Your roadmap was left unchanged.", kind: "success" })
    }
    setReplanBusy(false)
  }

  const retryReplanGeneration = async (proposalId: string, jobIds: string[]) => {
    if (replanBusy) return
    setReplanBusy(true)
    const result = await updateReplanProposal(roadmap.id, proposalId, "approved", jobIds)
    if (!result.ok) {
      toast({ title: "Could not retry lesson generation", message: "Refresh the roadmap and try again.", kind: "error" })
    } else if (result.failedJobIds?.length) {
      setFailedGenerationJobs((previous) => ({ ...previous, [proposalId]: result.failedJobIds ?? [] }))
      toast({ title: "Some lessons still need retry", message: "The remaining failed jobs are still available below.", kind: "error" })
    } else {
      setFailedGenerationJobs((previous) => {
        const next = { ...previous }
        delete next[proposalId]
        return next
      })
      toast({ title: "Lesson generation queued", message: "The focused-practice lessons are being prepared.", kind: "success" })
    }
    setReplanBusy(false)
  }

  const startFirstLesson = () => {
    if (!nextLesson) return
    localStorage.removeItem("hipath_roadmap_preview")
    setPreviewRoadmapId(null)
    router.push(`/roadmap/${roadmap.id}/lesson/${nextLesson.lesson.id}`)
  }

  return (
    <div className="flex min-h-screen bg-app" inert={examDialogOpen}>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="mx-auto w-full max-w-7xl p-4 pb-28 sm:p-6 lg:pb-8">
          <PageTransition>
            <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
              <Link href="/dashboard" className="transition-colors hover:text-foreground">
                Dashboard
              </Link>
              <span className="px-1.5" aria-hidden>
                /
              </span>
              <span className="text-foreground">Roadmap</span>
            </nav>

            <header className="mt-1 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="t-title text-2xl sm:text-3xl">{roadmap.title}</h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  {roadmap.description || "Your personalized learning plan."}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border bg-card px-2.5 py-1">
                    {roadmap.phases.length} phases
                  </span>
                  <span className="rounded-full border border-border bg-card px-2.5 py-1">
                    {total} lessons
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1">
                    {roadmapComplete ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-ok-fg" aria-hidden />
                    ) : remaining > 0 ? (
                      <Clock3 className="h-3.5 w-3.5 text-primary" aria-hidden />
                    ) : (
                      <Trophy className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                    )}
                    {timeChipLabel}
                  </span>
                  {roadmapComplete ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-ok-border bg-ok-bg px-2.5 py-1 font-medium text-ok-fg">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      Complete
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 self-start">
                <RoadmapActionsMenu
                  publishing={publishBusy}
                  replanning={replanBusy}
                  deleting={deleting}
                  onEdit={handleEdit}
                  onPublish={() => void requestPublish()}
                  onSuggestChange={() => void requestReplanProposal()}
                  onDelete={() => setConfirmDelete(true)}
                />
              </div>
            </header>

            {syncFailed ? (
              <Card
                role="status"
                className="mt-5 flex flex-col gap-3 border-warn-border bg-warn-bg/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warn-fg" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold">Some progress couldn&apos;t refresh</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      You&apos;re seeing what&apos;s saved on this device. Retry to pull the latest from your account.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSyncAttempt((value) => value + 1)}
                  disabled={syncing}
                  className="shrink-0"
                >
                  {syncing ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  )}
                  {syncing ? "Retrying…" : "Retry"}
                </Button>
              </Card>
            ) : null}

            {showRoadmapPreview ? (
              <Card className="mt-5 border-primary/30 bg-primary/5 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold">Your roadmap is ready to review</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {roadmap.phases.length} phases · {total} lessons. Start with a focused first lesson, then
                      follow the journey at your pace.
                    </p>
                  </div>
                  {nextLesson ? (
                    <Button size="sm" onClick={startFirstLesson} className="shrink-0">
                      Start first lesson
                    </Button>
                  ) : null}
                </div>
              </Card>
            ) : null}

            <div className="mt-5">
              <RoadmapHero
                pct={pct}
                passed={passed}
                total={total}
                remaining={remaining}
                timeLeft={timeLeft}
                streak={gam.streak}
                phaseCount={roadmap.phases.length}
                checkpointsPassed={checkpointsPassed}
                currentPhase={heroCurrentPhase}
                nextStep={heroNext}
                nextStepBusy={checkpointBusy}
                onOpenPhase={() => {
                  if (focusPhase) openPhase(focusPhase.id)
                  else scrollToPhases()
                }}
                onViewPhases={scrollToPhases}
                onOpenSkills={scrollToSkills}
              />
            </div>

            {hasAdaptationWork ? (
              <div className="mt-4">
                <PendingAdaptations
                  proposals={replanProposals}
                  busy={replanBusy}
                  failedJobs={failedGenerationJobs}
                  onApply={(proposal) => void decideReplanProposal(proposal, "approved")}
                  onDismiss={(proposal) => void decideReplanProposal(proposal, "rejected")}
                  onRetry={(proposalId, jobIds) => void retryReplanGeneration(proposalId, jobIds)}
                />
              </div>
            ) : null}

            <section aria-labelledby="journey-heading" className="mt-8">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 id="journey-heading" className="text-lg font-semibold">
                    Your journey
                  </h2>
                  <p className="text-xs text-muted-foreground">Tap a phase to jump to it.</p>
                </div>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                  {checkpointsPassed}/{lessonPhaseIndexes.length} checkpoints passed
                </span>
              </div>
              <JourneyStrip phases={journey} onSelect={openPhase} />
            </section>

            <section aria-labelledby="phases-heading" className="mt-8">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 id="phases-heading" className="scroll-mt-20 text-lg font-semibold">
                    Your phases
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {roadmapComplete
                      ? "All phases complete — revisit any lesson whenever you like."
                      : focusPhase
                        ? `Start with Phase ${focusPhaseIndex + 1} — ${focusPhase.title}.`
                        : "Pick up where you left off."}
                  </p>
                </div>
                <div
                  className="inline-flex w-fit rounded-full bg-muted p-1"
                  role="tablist"
                  aria-label="Lesson view mode"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "grid"}
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "inline-flex min-h-[32px] items-center gap-1 rounded-full px-3 text-xs transition-colors",
                      viewMode === "grid"
                        ? "bg-primary font-medium text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
                    Grid
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={viewMode === "list"}
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "inline-flex min-h-[32px] items-center gap-1 rounded-full px-3 text-xs transition-colors",
                      viewMode === "list"
                        ? "bg-primary font-medium text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <List className="h-3.5 w-3.5" aria-hidden />
                    List
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {roadmap.phases.map((phase, index) => {
                  const isOpen = openPhases[phase.id] ?? index === focusPhaseIndex
                  return (
                    <PhaseCard
                      key={phase.id}
                      roadmapId={roadmap.id}
                      phase={phase}
                      index={index}
                      totalPhases={roadmap.phases.length}
                      state={journey[index]?.state ?? "todo"}
                      progress={progress}
                      phaseProgress={phaseProgress}
                      open={isOpen}
                      onToggle={() =>
                        setOpenPhases((prev) => ({
                          ...prev,
                          [phase.id]: !(prev[phase.id] ?? index === focusPhaseIndex),
                        }))
                      }
                      viewMode={viewMode}
                      isLocked={(_lesson: Lesson, lessonIndex: number) =>
                        isLessonLockedIn(roadmap.phases, index, lessonIndex, progress, phaseProgress)
                      }
                      examLoaded={Boolean(phaseExams[phase.id])}
                      examSubmitted={phaseExams[phase.id]?.submitted ?? false}
                      examPassed={phaseExams[phase.id]?.passed ?? false}
                      examScore={phaseExams[phase.id]?.score ?? null}
                      examAnswered={Object.keys(phaseExams[phase.id]?.answers ?? {}).length}
                      examQuestionCount={phaseExams[phase.id]?.quiz.length ?? 0}
                      examBusy={Boolean(phaseExamLoading[phase.id])}
                      onStartCheckpoint={() => void handlePhaseExam(phase.id)}
                      onOpenCheckpoint={() => openExam(phase.id)}
                    />
                  )
                })}
              </div>
            </section>

            <div className="mt-8">
              <SkillsReadinessSection
                roadmapId={roadmap.id}
                skillNodes={skillNodes}
                refreshKey={`${passed}:${checkpointsPassed}`}
                openSignal={skillsOpenSignal}
              />
            </div>

            <AdaptationHistory revisions={replanRevisions} />

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Your roadmap adapts as you learn — pass lessons and checkpoints to unlock what comes next.
            </p>
          </PageTransition>
        </main>
      </div>

      <MobileContinueBar
        pct={pct}
        label={mobileLabel}
        title={mobileTitle}
        detail={mobileDetail}
        cta={mobileCta}
        busy={checkpointBusy}
      />

      {examDialogOpen ? (
        <PhaseExamDialog
          open
          phaseTitle={activeExamPhase?.title ?? ""}
          phaseIndex={activeExamIndex}
          exam={activeExam}
          submitting={Boolean(examPhaseId && phaseExamSubmitting[examPhaseId])}
          error={activeExamError}
          onSelect={(questionIndex, optionIndex) => {
            if (examPhaseId) selectExamAnswer(examPhaseId, questionIndex, optionIndex)
          }}
          onSubmit={() => {
            if (examPhaseId) void submitPhaseExam(examPhaseId)
          }}
          onClose={closeExam}
          onNewAttempt={() => {
            if (examPhaseId) startNewExamAttempt(examPhaseId)
          }}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete roadmap?"
        description="This removes the roadmap, its lessons, your progress, and chat history. This cannot be undone."
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onClose={() => {
          if (!deleting) setConfirmDelete(false)
        }}
      />
    </div>
  )
}
