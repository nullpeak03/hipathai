"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { loadRoadmap, loadRoadmapAsync, clearRoadmap, loadProgress, loadGam, loadGamAsync, loadProgressAsync, loadPhaseProgress, submitPhaseProgress, type RoadmapData, type Progress, type PhaseProgress } from "@/lib/store"
import type { Lesson, Phase } from "@/lib/mockData"
import type { QuizQuestion } from "@/lib/mockData"
import { useUser } from "@clerk/nextjs"
import { useToast } from "@/components/ui/toast"
import { QuizRichText } from "@/components/quiz/quiz-rich-text"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Lock, ChevronDown, LayoutGrid, List } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export default function RoadmapPage() {
  const router = useRouter()
  const { user } = useUser()
  const toast = useToast()
  const [roadmap, setRoadmap] = useState<RoadmapData | null | undefined>(undefined)
  const [progress, setProgress] = useState<Progress>({})
  const [gam, setGam] = useState({ streak: 0 })
  const [mounted, setMounted] = useState(false)
  const [viewMode, setViewMode] = useState<"grid"|"list">("grid")
  const [openPhases, setOpenPhases] = useState<Record<string,boolean>>({})
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [phaseExams, setPhaseExams] = useState<Record<string, { quiz: QuizQuestion[]; answers: Record<number, number>; submitted: boolean; score: number }>>({})
  const [phaseExamLoading, setPhaseExamLoading] = useState<Record<string, boolean>>({})
  const [phaseProgress, setPhaseProgress] = useState<PhaseProgress>({})

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
      const data = (await res.json()) as { quiz?: QuizQuestion[] }
      if (data.quiz) setPhaseExams((prev) => ({ ...prev, [phaseId]: { quiz: data.quiz as QuizQuestion[], answers: {}, submitted: false, score: 0 } }))
    } catch {
      toast({ title: "Phase quiz unavailable", message: "Could not generate phase quiz. Try again.", kind: "error" })
    } finally {
      setPhaseExamLoading((prev) => ({ ...prev, [phaseId]: false }))
    }
  }
  const submitPhaseExam = async (phaseId: string) => {
    const exam = phaseExams[phaseId]
    if (!exam) return
    let correct = 0
    exam.quiz.forEach((q, i) => { if (exam.answers[i] === q.correct) correct++ })
    const sc = Math.round((correct / exam.quiz.length) * 100)
    const passed = sc >= 60
    setPhaseExams((prev) => ({ ...prev, [phaseId]: { ...exam, submitted: true, score: sc } }))
    try {
      await submitPhaseProgress(phaseId, passed, sc)
      setPhaseProgress((prev) => {
        const prevAttempts = prev[phaseId]?.attempts ?? 0
        return { ...prev, [phaseId]: { passed, score: sc, attempts: prevAttempts + 1 } }
      })
    } catch {}
  }

  useEffect(()=>{
    setMounted(true)
    setRoadmap(loadRoadmap())
    setProgress(loadProgress())
    setGam(loadGam())
    const vm = localStorage.getItem("hipath_viewMode") as "grid" | "list" | null
    if (vm) setViewMode(vm)
  }, [])
  // Reconcile with Supabase (source of truth; helpers degrade to cache)
  useEffect(()=> {
    ;(async () => {
      try {
        const [rm, gm, prog, phProg] = await Promise.all([
          loadRoadmapAsync(),
          loadGamAsync(),
          loadProgressAsync(),
          loadPhaseProgress(),
        ])
        if (rm) setRoadmap(rm)
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
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 text-2xl">🗺️</div>
              <h2 className="text-xl font-bold">No roadmap yet</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">Create your first personalized roadmap — tell us your goal, level, and time, and HiPath AI will build a structured, adaptive plan with AI.</p>
              <Link href="/onboarding"><Button className="mt-6">Create Roadmap →</Button></Link>
              <p className="text-xs text-zinc-400 mt-4">Flexible — your roadmap adapts to your pace. Edit anytime.</p>
            </div>
          </main>
        </div>
      </div>
    )
  }
  const allLessons = roadmap.phases.flatMap((p)=> p.lessons)
  const done = Object.values(progress).filter((p)=>p.completed).length
  const total = allLessons.length
  const pct = total ? Math.round((done/total)*100) : 0

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

  // Flexible lock: supports DAG prerequisites if lesson has prerequisites field, else linear + phase exam gate
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
    return !(progress[prevLesson.id]?.completed && progress[prevLesson.id]?.passed)
  }

  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <div className="text-sm text-muted-foreground mb-2">Dashboard &gt; Roadmap</div>
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
            <div>
              <h1 className="text-2xl font-bold">{roadmap.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">{roadmap.description}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="flex border border-border rounded-lg overflow-hidden">
                <button onClick={()=> setViewMode("grid")} className={`px-3 py-1.5 text-xs flex items-center gap-1 ${viewMode==="grid" ? "bg-primary text-primary-foreground" : "bg-card"}`}><LayoutGrid className="w-3 h-3"/> Grid</button>
                <button onClick={()=> setViewMode("list")} className={`px-3 py-1.5 text-xs flex items-center gap-1 ${viewMode==="list" ? "bg-primary text-primary-foreground" : "bg-card"}`}><List className="w-3 h-3"/> List</button>
              </div>
              <Button variant="outline" size="sm" onClick={handleEdit}>Edit</Button>
              <Button variant="outline" size="sm" className="text-danger-fg border-danger-border" onClick={()=> setConfirmDelete(true)} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</Button>
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
            <Card className="p-4 text-center"><div className="text-primary font-bold text-lg">{pct}%</div><div className="text-xs text-muted-foreground">Complete</div></Card>
            <Card className="p-4 text-center"><div className="font-bold text-lg">{total - done}</div><div className="text-xs text-muted-foreground">Lessons remaining</div></Card>
            <Card className="p-4 text-center"><div className="font-bold text-lg">{gam.streak} days</div><div className="text-xs text-muted-foreground">Current streak</div></Card>
          </div>

          <div className="mt-6 space-y-4">
            {roadmap.phases.map((phase, pi)=>{
              const isOpen = openPhases[phase.id] ?? (pi===0)
              const phaseDone = phase.lessons.filter((l)=> progress[l.id]?.passed).length
              return (
                <Card key={phase.id} className="overflow-hidden">
                  <button onClick={()=> setOpenPhases(prev=> ({...prev, [phase.id]: !isOpen}))} className="w-full flex items-center justify-between p-4 hover:bg-muted text-left">
                    <div>
                      <h3 className="font-semibold">Week {pi+1}: {phase.title}</h3>
                      <p className="text-xs text-muted-foreground">{phaseDone} / {phase.lessons.length} completed • Week {pi+1} of {roadmap.phases.length}</p>
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
                              <Link href={locked ? "#" : `/roadmap/${roadmap.id}/lesson/${lesson.id}`} className={`rounded-xl border p-4 flex ${viewMode==="grid" ? "flex-col items-center text-center gap-2" : "flex-row items-center gap-4"} transition ${locked?"bg-muted opacity-60 cursor-not-allowed": completed?"bg-ok-bg border-ok-border":"bg-card hover:border-primary hover:shadow-md"}`}>
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
                              {phaseExamLoading[phase.id] ? "Generating phase quiz…" : `Phase Mastery Quiz • ${phase.lessons.length} lessons • 6 Qs`}
                            </Button>
                          ) : (
                            <div className="mt-4 border-t border-border pt-4">
                              <h4 className="font-semibold text-sm">Phase Mastery Quiz — 6 questions across this phase</h4>
                              <div className="mt-4 space-y-4">
                                {phaseExams[phase.id]!.quiz.map((q, i) => (
                                  <div key={i} className="border border-border rounded-xl p-4 bg-card">
                                    <div className="font-medium text-sm">{i + 1}. <QuizRichText text={q.q} /></div>
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
                                          <span className="flex-1 min-w-0"><QuizRichText text={opt} /></span>
                                        </label>
                                      ))}
                                    </div>
                                    {phaseExams[phase.id]!.submitted && (
                                      <div className={`mt-2 text-xs ${phaseExams[phase.id]!.answers[i] === q.correct ? "text-ok-fg" : "text-danger-fg"}`}>
                                        {phaseExams[phase.id]!.answers[i] === q.correct ? "✓ Correct" : "✗ Wrong"} — <QuizRichText text={q.explanation} />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
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
                                    {phaseExams[phase.id]!.score >= 60 ? `Passed — ${phaseExams[phase.id]!.score}%` : `Scored ${phaseExams[phase.id]!.score}% — review lessons and retry`}
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
              )
            })}
          </div>
          <p className="text-xs text-zinc-400 mt-6 text-center">Your roadmap adapts as you learn — complete lessons to unlock what comes next.</p>
        </main>
      </div>
    </div>
  )
}
