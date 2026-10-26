"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { loadRoadmap, loadRoadmapAsync, clearRoadmap, loadProgress, loadGam, loadGamAsync, loadProgressAsync, loadPhaseProgress, loadMasteryAsync, syncSkillGraph, loadSkillGraphAsync, loadReplanHistory, createReplanProposal, updateReplanProposal, submitAssessment, type RoadmapData, type Progress, type PhaseProgress, type ReplanProposalRecord, type RoadmapRevisionRecord } from "@/lib/store"
import type { Lesson, Phase } from "@/lib/mockData"
import type { AssessmentResult, IssuedAssessment } from "@/lib/assessment"
import { useUser } from "@clerk/nextjs"
import { useToast } from "@/components/ui/toast"
import { QuizRichText } from "@/components/quiz/quiz-rich-text"
import { PageTransition } from "@/components/motion/page-transition"
import { JourneyStrip, type JourneyPhase } from "@/components/roadmap/journey-strip"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, X, Lock, Map, ChevronDown, LayoutGrid, List, MoreHorizontal, PlayCircle } from "lucide-react"
import { IconBadge } from "@/components/ui/icon-badge"
import { motion, AnimatePresence } from "framer-motion"
import { staggerParent, staggerChild } from "@/lib/motion"
import { PHASE_EXAM_PASS_THRESHOLD } from "@/lib/v2-mastery"
import { SkillReadinessPanel } from "@/components/readiness/skill-readiness-panel"

export default function RoadmapPage() {
  const router = useRouter()
  const { user } = useUser()
  const toast = useToast()
  const [roadmap, setRoadmap] = useState<RoadmapData | null | undefined>(undefined)
  const [progress, setProgress] = useState<Progress>({})
  const [gam, setGam] = useState({ streak: 0 })
  const [mounted, setMounted] = useState(false)
  const [viewMode, setViewMode] = useState<"grid"|"list">("grid")
  const [actionsOpen, setActionsOpen] = useState(false)
  const [openPhases, setOpenPhases] = useState<Record<string,boolean>>({})
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [phaseExams, setPhaseExams] = useState<Record<string, { assessmentId: string; quiz: IssuedAssessment["quiz"]; answers: Record<number, number>; submitted: boolean; score: number; passed: boolean; results?: AssessmentResult["results"] }>>({})
  const [phaseExamLoading, setPhaseExamLoading] = useState<Record<string, boolean>>({})
  const [phaseProgress, setPhaseProgress] = useState<PhaseProgress>({})
  const [skillNodes, setSkillNodes] = useState<{ topic: string; mastery?: number }[]>([])
  const [skillMasteryOpen, setSkillMasteryOpen] = useState(true)
  const [replanProposals, setReplanProposals] = useState<ReplanProposalRecord[]>([])
  const [replanRevisions, setReplanRevisions] = useState<RoadmapRevisionRecord[]>([])
  const [replanBusy, setReplanBusy] = useState(false)
  const [failedGenerationJobs, setFailedGenerationJobs] = useState<Record<string, string[]>>({})
  const [previewRoadmapId, setPreviewRoadmapId] = useState<string | null>(null)

  const handlePhaseExam = async (phaseId: string) => {
    if (phaseExamLoading[phaseId]) return
    setPhaseExamLoading((prev) => ({ ...prev, [phaseId]: true }))
    try {
      const res = await fetch("/api/phases/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phaseId }),
      })
      if (!res.ok) throw new Error("Failed")
      const issued = (await res.json()) as IssuedAssessment
      if (issued.assessmentId && issued.quiz) setPhaseExams((prev) => ({ ...prev, [phaseId]: { ...issued, answers: {}, submitted: false, score: 0, passed: false } }))
    } catch {
      toast({ title: "Phase quiz unavailable", message: "Could not generate phase quiz. Try again.", kind: "error" })
    } finally {
      setPhaseExamLoading((prev) => ({ ...prev, [phaseId]: false }))
    }
  }
  const submitPhaseExam = async (phaseId: string) => {
    const exam = phaseExams[phaseId]
    if (!exam) return
    const result = await submitAssessment(exam.assessmentId, exam.answers)
    if (!result) {
      toast({ title: "Phase quiz submission failed", message: "Your answers could not be graded. Please retry.", kind: "error" })
      return
    }
    setPhaseExams((prev) => ({ ...prev, [phaseId]: { ...exam, submitted: true, score: result.score, passed: result.passed, results: result.results } }))
    const prevAttempts = phaseProgress[phaseId]?.attempts ?? 0
    setPhaseProgress((prev) => ({
      ...prev,
      [phaseId]: {
        passed: prev[phaseId]?.passed === true || result.passed,
        score: result.score,
        attempts: prevAttempts + 1,
      },
    }))
  }

  useEffect(() => {
    if (!actionsOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setActionsOpen(false) }
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target?.closest("[data-roadmap-actions]")) setActionsOpen(false)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("mousedown", onClick)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("mousedown", onClick)
    }
  }, [actionsOpen])

  useEffect(()=>{
    setMounted(true)
    setRoadmap(loadRoadmap())
    setPreviewRoadmapId(localStorage.getItem("hipath_roadmap_preview"))
    setProgress(loadProgress())
    setGam(loadGam())
    const vm = localStorage.getItem("hipath_viewMode") as "grid" | "list" | null
    if (vm) setViewMode(vm)
  }, [])
  // Reconcile with Supabase (source of truth; helpers degrade to cache)
  useEffect(()=> {
    ;(async () => {
      try {
        const [rm, gm, prog, phProg, mastery] = await Promise.all([
          loadRoadmapAsync(),
          loadGamAsync(),
          loadProgressAsync(),
          loadPhaseProgress(),
          loadMasteryAsync(),
        ])
        if (rm) {
          setRoadmap(rm)
          const nodes = rm.phases.flatMap((phase) =>
            phase.lessons.map((lesson) => ({
              roadmap_id: rm.id,
              lesson_id: lesson.id,
              topic: lesson.title,
              difficulty: null,
              prerequisites: lesson.prerequisites ?? [],
            }))
          )
          void (async () => {
            await syncSkillGraph(rm.id, nodes)
            let graph = await loadSkillGraphAsync(rm.id)
            if (!graph || graph.length === 0) {
              graph = nodes
            }
            const masteryMap = new globalThis.Map(mastery.map((m) => [m.topic, m.mastery_score]))
            setSkillNodes(graph.map((n) => ({ topic: n.topic, mastery: masteryMap.get(n.topic) })))
          })()
          void loadReplanHistory(rm.id).then(({ proposals, revisions }) => {
            setReplanProposals(proposals)
            setReplanRevisions(revisions)
          })
        }
        if (gm) setGam(gm)
        if (prog && Object.keys(prog).length) setProgress(prog)
        if (phProg) setPhaseProgress(phProg)
      } catch {}
    })()
  }, [user?.id])
  useEffect(()=> { if (mounted) localStorage.setItem("hipath_viewMode", viewMode) }, [viewMode, mounted])

  if (!mounted || roadmap === undefined) {
    return (
      <div className="flex min-h-screen bg-app">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0"><Header />
          <main className="p-8 max-w-7xl w-full mx-auto">
            <div className="animate-pulse space-y-4"><div className="h-8 bg-muted rounded w-1/3"/><div className="h-32 bg-muted rounded"/><div className="h-64 bg-muted rounded"/></div>
          </main>
        </div>
      </div>
    )
  }
  if (roadmap === null) {
    return (
      <div className="flex min-h-screen bg-app">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0"><Header />
          <main className="p-8 max-w-7xl w-full mx-auto">
            <div className="text-center py-16 bg-card rounded-2xl border border-border">
              <div className="mb-4 flex justify-center"><IconBadge icon={Map} size="lg" /></div>
              <h2 className="text-xl font-bold">No roadmap yet</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">Create your first personalized roadmap — tell us your goal, level, and time, and HiPath AI will build a structured, adaptive plan with AI.</p>
              <Link href="/onboarding"><Button className="mt-6">Create Roadmap →</Button></Link>
              <p className="text-xs text-muted-foreground mt-4">Flexible — your roadmap adapts to your pace. Edit anytime.</p>
            </div>
          </main>
        </div>
      </div>
    )
  }
  const allLessons = roadmap.phases.flatMap((p)=> p.lessons)
  const continueLesson = allLessons.find((l) => !progress[l.id]?.passed) ?? allLessons[0]
  const done = Object.values(progress).filter((p)=>p.completed).length
  const total = allLessons.length
  const pct = total ? Math.round((done/total)*100) : 0
  const showRoadmapPreview = previewRoadmapId === roadmap.id
  // Journey strip states: first incomplete phase is current, completed are done.
  let journeySeenCurrent = false
  const journey: JourneyPhase[] = roadmap.phases.map((p) => {
    const doneCount = p.lessons.filter((l) => progress[l.id]?.passed).length
    const complete = doneCount === p.lessons.length && p.lessons.length > 0
    const state: JourneyPhase["state"] = complete ? "done" : !journeySeenCurrent ? "current" : "todo"
    if (!complete && !journeySeenCurrent) journeySeenCurrent = true
    return { id: p.id, title: p.title, state, done: doneCount, total: p.lessons.length }
  })

  const handleDelete = async () => {
    if (!roadmap) return
    setConfirmDelete(false)
    // Delete server-side first (phases, lessons, progress, and chat history
    // cascade); only clear the local cache once the server confirms.
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
    setRoadmap(null)
    router.push("/onboarding")
  }
  const handleEdit = () => {
    router.push(`/onboarding?edit=${roadmap.id}`)
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
      if (updatedRoadmap) setRoadmap(updatedRoadmap)
      toast({
        title: "Roadmap updated",
        message: (result.failedJobIds?.length ?? 0) > 0
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

  // Progression uses pass status; mastery remains a separate learning signal.
  // Supports DAG prerequisites if lesson has them, otherwise linear + phase exam gate.
  const isLessonLocked = (phase: Phase, pi: number, lesson: Lesson, idx: number) => {
    // Phase gate: need previous phase exam 60% or 2 attempts (skip → remedial)
    if (pi > 0) {
      const prevPhase = roadmap.phases[pi - 1]
      const prevDone = prevPhase.lessons.filter((l) => progress[l.id]?.passed).length
      if (prevDone === prevPhase.lessons.length && prevPhase.lessons.length > 0) {
        const prog = phaseProgress[prevPhase.id]
        if (!prog?.passed && (prog?.attempts ?? 0) < 2) {
          // If never attempted, gate. If attempted but <2 and not passed, still gated.
          // Allow unlock after 2 fails (remedial path).
          if (!prog) return true
          if (!prog.passed) return true
        }
      }
    }
    if (lesson.prerequisites && Array.isArray(lesson.prerequisites)) {
      return !lesson.prerequisites.every((id)=> progress[id]?.passed)
    }
    const isFirstOverall = pi===0 && idx===0
    if (isFirstOverall) return false
    const prevLesson = idx>0 ? phase.lessons[idx-1] : roadmap.phases[pi-1]?.lessons[roadmap.phases[pi-1].lessons.length-1]
    if (!prevLesson) return false
    const prevProgress = progress[prevLesson.id]
    return !prevProgress?.passed
  }

  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <PageTransition>
          <div className="text-sm text-muted-foreground mb-2">Dashboard &gt; Roadmap</div>
          {showRoadmapPreview && (
            <Card className="mb-5 flex flex-col gap-3 border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">Your roadmap is ready to review</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {roadmap.phases.length} weekly phases · {total} lessons. Review the journey below, then start with a focused first lesson.
                </p>
              </div>
              {continueLesson && (
                <Button onClick={() => {
                  localStorage.removeItem("hipath_roadmap_preview")
                  setPreviewRoadmapId(null)
                  router.push(`/roadmap/${roadmap.id}/lesson/${continueLesson.id}`)
                }} className="shrink-0">Start first lesson</Button>
              )}
            </Card>
          )}
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
            <div>
              <h1 className="text-2xl font-bold">{roadmap.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">{roadmap.description}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="flex bg-muted rounded-full p-1 gap-1" role="tablist" aria-label="View mode">
                <button role="tab" aria-selected={viewMode==="grid"} onClick={()=> setViewMode("grid")} className={`px-3 py-1.5 text-xs flex items-center gap-1 rounded-full transition-colors ${viewMode==="grid" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><LayoutGrid className="w-3 h-3"/> Grid</button>
                <button role="tab" aria-selected={viewMode==="list"} onClick={()=> setViewMode("list")} className={`px-3 py-1.5 text-xs flex items-center gap-1 rounded-full transition-colors ${viewMode==="list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><List className="w-3 h-3"/> List</button>
              </div>
              {continueLesson && !showRoadmapPreview && (
                <Link href={`/roadmap/${roadmap.id}/lesson/${continueLesson.id}`}>
                  <Button size="sm"><PlayCircle className="w-4 h-4 mr-1" />Continue</Button>
                </Link>
              )}
              <div className="relative" data-roadmap-actions>
                <Button variant="outline" size="sm" onClick={() => setActionsOpen((o) => !o)} aria-haspopup="menu" aria-expanded={actionsOpen} aria-label="Roadmap actions">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
                {actionsOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-44 rounded-xl border border-border bg-card shadow-lg z-30 p-1">
                    <button role="menuitem" onClick={() => { setActionsOpen(false); handleEdit() }} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted">Edit roadmap</button>
                    <button role="menuitem" onClick={() => { setActionsOpen(false); if (roadmap) void fetch("/api/me/review-queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roadmapId: roadmap.id, reason: "User requested publish" }) }) }} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted">
                      Request publish
                    </button>
                    <button role="menuitem" onClick={() => { setActionsOpen(false); void requestReplanProposal() }} disabled={replanBusy} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted disabled:opacity-50">
                      Suggest roadmap change
                    </button>
                    <button role="menuitem" onClick={() => { setActionsOpen(false); setConfirmDelete(true) }} disabled={deleting} className="w-full text-left px-3 py-2 text-sm rounded-lg text-danger-fg hover:bg-danger-bg disabled:opacity-50">
                      {deleting ? "Deleting…" : "Delete roadmap"}
                    </button>
                  </div>
                )}
              </div>
              <ConfirmDialog
                open={confirmDelete}
                title="Delete roadmap?"
                description="This removes the roadmap, its lessons, your progress, and chat history. This cannot be undone."
                confirmLabel="Delete"
                danger
                busy={deleting}
                onConfirm={()=> void handleDelete()}
                onClose={()=> { if (!deleting) setConfirmDelete(false) }}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6">
            <Card className="p-4 text-center card-lift"><div className="text-primary font-bold text-lg">{pct}%</div><div className="text-xs text-muted-foreground">Complete</div></Card>
            <Card className="p-4 text-center card-lift"><div className="font-bold text-lg">{total - done}</div><div className="text-xs text-muted-foreground">Lessons remaining</div></Card>
            <Card className="p-4 text-center card-lift"><div className="font-bold text-lg">{gam.streak} days</div><div className="text-xs text-muted-foreground">Current streak</div></Card>
          </div>

          {(replanProposals.some((proposal) => proposal.status === "pending") || replanRevisions.length > 0) && (
            <Card className="mt-4 p-4">
              <h2 className="text-sm font-semibold">Roadmap adaptations</h2>
              {replanProposals.filter((proposal) => proposal.status === "pending").map((proposal) => {
                const proposedTopics = Array.isArray(proposal.proposed_changes.topics)
                  ? proposal.proposed_changes.topics.flatMap((entry) => {
                    if (!entry || typeof entry !== "object") return []
                    const value = entry as { topic?: unknown; failCount?: unknown }
                    return typeof value.topic === "string"
                      ? [{ topic: value.topic, failCount: typeof value.failCount === "number" ? value.failCount : null }]
                      : []
                  })
                  : []
                return (
                  <div key={proposal.id} className="mt-3 rounded-xl border border-warn-border bg-warn-bg p-4">
                    <div className="text-sm font-semibold text-warn-fg">Suggested change — awaiting your decision</div>
                    <p className="mt-1 text-xs text-warn-fg">{proposal.reason}</p>
                    {proposedTopics.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-warn-fg">
                        {proposedTopics.map(({ topic, failCount }) => (
                          <li key={topic}>Add focused practice for <strong>{topic}</strong>{failCount !== null ? ` (missed ${failCount} times)` : ""}.</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-warn-fg">This older request has no saved change preview. Dismiss it and request a fresh proposal to review concrete changes.</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => void decideReplanProposal(proposal, "approved")} disabled={replanBusy || proposedTopics.length === 0}>
                        Apply changes
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void decideReplanProposal(proposal, "rejected")} disabled={replanBusy}>
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )
              })}
              {replanRevisions.length > 0 && (
                <div className="mt-4 border-t border-border pt-3">
                  <h3 className="text-xs font-semibold text-muted-foreground">Applied changes</h3>
                  <ul className="mt-2 space-y-2">
                    {replanRevisions.map((revision) => {
                      const topics = Array.isArray(revision.changes?.topics)
                        ? revision.changes.topics.filter((topic): topic is string => typeof topic === "string")
                        : []
                      return (
                        <li key={revision.id} className="text-xs">
                          <p>{topics.length > 0 ? `Added focused practice for ${topics.join(", ")}.` : revision.reason}</p>
                          {topics.length > 0 && <p className="mt-0.5 text-muted-foreground">{revision.reason}</p>}
                          <time className="mt-0.5 block text-[10px] text-muted-foreground" dateTime={revision.created_at}>
                            {new Date(revision.created_at).toLocaleDateString()}
                          </time>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              {Object.entries(failedGenerationJobs).map(([proposalId, jobIds]) => (
                <div key={proposalId} className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warn-border bg-warn-bg p-3">
                  <p className="text-xs text-warn-fg">{jobIds.length} focused-practice lesson{jobIds.length === 1 ? "" : "s"} could not be queued yet.</p>
                  <Button variant="outline" size="sm" onClick={() => void retryReplanGeneration(proposalId, jobIds)} disabled={replanBusy}>
                    Retry generation
                  </Button>
                </div>
              ))}
            </Card>
          )}
          <Card className="p-4 mt-4">
            <button onClick={() => setSkillMasteryOpen((o) => !o)} className="w-full flex items-center justify-between text-left">
              <div className="font-semibold text-sm">Skill mastery</div>
              <span className="text-xs text-muted-foreground">{skillMasteryOpen ? "Hide" : "Show"}</span>
            </button>
            {skillMasteryOpen && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-3">
              {skillNodes.map((node) => (
                <div key={node.topic} className="rounded-lg border border-border p-3">
                  <div className="text-xs font-medium truncate">{node.topic}</div>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-2 bg-primary rounded-full" style={{ width: `${node.mastery ?? 0}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">{node.mastery ?? 0}%</div>
                </div>
              ))}
              {skillNodes.length === 0 && <div className="text-xs text-muted-foreground">Skill graph will appear after roadmap loads.</div>}
            </div>
            )}
          </Card>
          <div className="mt-4">
            <SkillReadinessPanel
              roadmapId={roadmap.id}
              refreshKey={`${Object.values(progress).filter((item) => item.passed).length}:${Object.values(phaseProgress).filter((item) => item.passed).length}`}
            />
          </div>
          <JourneyStrip
            phases={journey}
            onSelect={(id) => {
              setOpenPhases((prev) => ({ ...prev, [id]: true }))
              requestAnimationFrame(() => {
                document.getElementById(`phase-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
              })
            }}
          />
          <motion.div className="mt-6 space-y-4" variants={staggerParent} initial="hidden" animate="show">
            {roadmap.phases.map((phase, pi)=>{
              const isOpen = openPhases[phase.id] ?? (pi===0)
              const phaseDone = phase.lessons.filter((l)=> progress[l.id]?.passed).length
              return (
                <motion.div key={phase.id} variants={staggerChild} id={`phase-${phase.id}`} className="scroll-mt-20">
                <Card className="overflow-hidden">
                  <button onClick={()=> setOpenPhases(prev=> ({...prev, [phase.id]: !isOpen}))} className="w-full flex items-center justify-between p-4 hover:bg-muted text-left">
                    <div>
                      <h3 className="font-semibold">Phase {pi+1}: {phase.title}</h3>
                      <p className="text-xs text-muted-foreground">{phaseDone} / {phase.lessons.length} completed • Phase {pi+1} of {roadmap.phases.length}</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{height:0, opacity:0}} animate={{height:"auto", opacity:1}} exit={{height:0, opacity:0}} className="overflow-hidden">
                        <div className={`p-4 pt-0 ${viewMode==="grid" ? "grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3" : "space-y-2"}`}>
                          {phase.lessons.map((lesson, idx)=>{
                            const locked = isLessonLocked(phase, pi, lesson, idx)
                            const completed = progress[lesson.id]?.completed && progress[lesson.id]?.passed
                            const card = (
                              <Link href={locked ? "#" : `/roadmap/${roadmap.id}/lesson/${lesson.id}`} aria-disabled={locked} className={`rounded-xl border p-4 flex ${viewMode==="grid" ? "flex-col items-center text-center gap-2" : "flex-row items-center gap-4"} ${locked?"bg-muted opacity-60 cursor-not-allowed": completed?"bg-ok-bg border-ok-border":"bg-card card-lift"}`}>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${completed?"bg-emerald-500 text-white": locked?"bg-muted text-muted-foreground":"bg-primary text-primary-foreground"}`}>{completed? <Check className="w-5 h-5"/> : locked? <Lock className="w-4 h-4"/> : lesson.idx}</div>
                                <div className={viewMode==="grid" ? "text-center" : "flex-1 text-left"}>
                                  <div className="text-xs font-medium leading-tight line-clamp-2">{lesson.title}</div>
                                  <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1 flex-wrap">
                                    <span>{locked? "Locked — pass previous phase" : completed? "Completed" : "Start →"}</span>
                                    {lesson.estimatedMinutes ? <span className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">~{lesson.estimatedMinutes} min</span> : null}
                                  </div>
                                </div>
                              </Link>
                            )
                            return viewMode==="grid" ? (
                              <motion.div key={lesson.id} whileHover={!locked? {y:-2, scale:1.02}: {}} transition={{type:"spring", stiffness:300}}>
                                {card}
                              </motion.div>
                            ) : <div key={lesson.id}>{card}</div>
                          })}
                        </div>
                        <div className="px-4 pb-4">
                          {!phaseExams[phase.id] ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handlePhaseExam(phase.id)}
                              disabled={!!phaseExamLoading[phase.id]}
                              className="mt-2"
                            >
                              {phaseExamLoading[phase.id] ? "Generating phase quiz…" : `Phase Mastery Quiz • ${phase.lessons.length} lessons • 10+ Qs`}
                            </Button>
                          ) : (
                            <div className="mt-4 border-t border-border pt-4">
                              <h4 className="font-semibold text-sm">Phase Mastery Quiz — 6 questions across this phase</h4>
                              <motion.div className="mt-4 space-y-4" variants={staggerParent} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-50px" }}>
                                {phaseExams[phase.id]!.quiz.map((q, i) => (
                                  <motion.div key={i} variants={staggerChild} className="border border-border rounded-xl p-4 bg-card">
                                    <div className="font-medium text-sm">{i + 1}. <QuizRichText text={q.q} draftKey={`exam:${phase.id}:q${i}`} /></div>
                                    <div className="grid gap-2 mt-3">
                                      {q.options.map((opt, oi) => (
                                        <label
                                          key={oi}
                                          className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer text-sm ${phaseExams[phase.id]!.answers[i] === oi ? "border-primary bg-info-bg" : "bg-card"}`}
                                        >
                                          <input
                                            type="radio"
                                            name={`phase-${phase.id}-q-${i}`}
                                            checked={phaseExams[phase.id]!.answers[i] === oi}
                                            onChange={() => {
                                              if (phaseExams[phase.id]!.submitted) return
                                              setPhaseExams((prev) => ({
                                                ...prev,
                                                [phase.id]: {
                                                  ...prev[phase.id]!,
                                                  answers: { ...prev[phase.id]!.answers, [i]: oi },
                                                },
                                              }))
                                            }}
                                          />
                                          <span className="flex-1 min-w-0"><QuizRichText text={opt} interactive={false} /></span>
                                        </label>
                                      ))}
                                    </div>
                                    {phaseExams[phase.id]!.submitted && (
                                      <div className={`mt-2 text-xs ${phaseExams[phase.id]!.results?.[i]?.correct ? "text-ok-fg" : "text-danger-fg"}`}>
                                        <span className="inline-flex items-center gap-1">{phaseExams[phase.id]!.results?.[i]?.correct ? <><Check className="w-3.5 h-3.5" /> Correct</> : <><X className="w-3.5 h-3.5" /> Wrong</>} — <QuizRichText text={phaseExams[phase.id]!.results?.[i]?.explanation ?? q.explanation} draftKey={`exam:${phase.id}:e${i}`} /></span>
                                      </div>
                                    )}
                                  </motion.div>
                                ))}
                              </motion.div>
                              {!phaseExams[phase.id]!.submitted ? (
                                <Button
                                  size="sm"
                                  className="mt-4"
                                  onClick={() => submitPhaseExam(phase.id)}
                                  disabled={Object.keys(phaseExams[phase.id]!.answers).length < phaseExams[phase.id]!.quiz.length}
                                >
                                  Submit Phase Quiz
                                </Button>
                              ) : (
                                <div className="mt-4 flex items-center gap-3">
                                  <span className="text-sm font-semibold">
                                    {phaseExams[phase.id]!.score >= PHASE_EXAM_PASS_THRESHOLD ? `Passed — ${phaseExams[phase.id]!.score}%` : `Scored ${phaseExams[phase.id]!.score}% — review lessons and retry`}
                                  </span>
                                  <button
                                    onClick={() =>
                                      setPhaseExams((prev) => {
                                        const copy = { ...prev }
                                        delete copy[phase.id]
                                        return copy
                                      })
                                    }
                                    className="text-xs text-primary underline"
                                  >
                                    Dismiss
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
                </motion.div>
              )
            })}
          </motion.div>
          <p className="text-xs text-muted-foreground mt-6 text-center">Your roadmap adapts as you learn — complete lessons to unlock what comes next.</p>
          </PageTransition>
        </main>
      </div>
    </div>
  )
}
