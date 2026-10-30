"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import { staggerParent, staggerChild } from "@/lib/motion"
import { AnimatedNumber } from "@/components/effects/animated-number"
import { ConfettiBurst } from "@/components/effects/confetti-burst"
import { Lock, BookOpen, Check, X, Loader2, RefreshCw } from "lucide-react"
import { IconBadge } from "@/components/ui/icon-badge"
import { useEffect, useRef, useState } from "react"
import { loadRoadmap, loadRoadmapAsync, loadProgress, saveProgress, saveRoadmap, requestQuiz, requestLessonContent, deleteQuizBank, waitForJob, submitAssessment, loadGamAsync, loadProgressAsync } from "@/lib/store"
import type { Lesson } from "@/lib/mockData"
import type { AssessmentResult, IssuedAssessment } from "@/lib/assessment"
import { needsRealContent } from "@/lib/lesson-content"
import { isLessonContent } from "@/lib/lesson-content-blocks"
import { LessonBody } from "@/components/lesson/lesson-body"
import { QuizRichText } from "@/components/quiz/quiz-rich-text"
import { Creature } from "@/components/creature/creature"
import { PageTransition } from "@/components/motion/page-transition"
import { friendlyGenerationError } from "@/lib/generation-errors"
import { LESSON_PASS_THRESHOLD, V2_MASTERY_THRESHOLD } from "@/lib/v2-mastery"
import { useUser } from "@clerk/nextjs"
import { useToast } from "@/components/ui/toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { trackEvent } from "@/components/analytics/posthog-provider"
import { CapstoneEvidencePanel } from "@/components/lesson/capstone-evidence-panel"
import { isCapstoneTitle } from "@/lib/capstone-evidence"
import Link from "next/link"

export default function LessonPage() {
  const { id: roadmapId, lessonId } = useParams() as { id: string; lessonId: string }
  const { user } = useUser()
  const toast = useToast()
  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [activeQuiz, setActiveQuiz] = useState<IssuedAssessment["quiz"]>([])
  const [assessmentId, setAssessmentId] = useState<string | null>(null)
  const [gradeResults, setGradeResults] = useState<AssessmentResult["results"]>([])
  const [mounted, setMounted] = useState(false)
  const [locked, setLocked] = useState(false)
  const [remedialMsg, setRemedialMsg] = useState("")
  const [quizLoading, setQuizLoading] = useState(false)
  const [creatureMsg, setCreatureMsg] = useState<string | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const contentAbortRef = useRef<AbortController | null>(null)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [contentStatus, setContentStatus] = useState("")
  const [contentError, setContentError] = useState<string | null>(null)
  const [weakInsight, setWeakInsight] = useState<string | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [quizMode, setQuizMode] = useState<"standard" | "remedial">("standard")
  const [variantLoading, setVariantLoading] = useState(false)
  const [challenge, setChallenge] = useState<{ assessmentId: string; quiz: IssuedAssessment["quiz"]; answers: Record<number, number>; submitted: boolean; score: number; results?: AssessmentResult["results"] } | null>(null)
  const [challengeLoading, setChallengeLoading] = useState(false)
  // Auto-quiz fires once per lesson (reset on navigation) — see effect below.
  const quizAutoRef = useRef<string | null>(null)

  useEffect(()=>{
    setMounted(true)
    // Reset per-lesson UI state when navigating between lessons
    setSubmitted(false)
    setLocked(false)
    setAnswers({})
    setScore(0)
    setActiveQuiz([])
    setAssessmentId(null)
    setGradeResults([])
    setChallenge(null)
    setQuizMode("standard")
    setWeakInsight(null)
    setInsightLoading(false)
    setContentError(null)
    ;(async () => {
      // Supabase is the source of truth; localStorage is cache (covers
      // direct navigation and new devices with an empty cache).
      let rm = loadRoadmap()
      if (!rm) {
        rm = await loadRoadmapAsync()
      }
      if (!rm) { setLesson(null); return }
      const all = rm.phases.flatMap((p, pi)=> p.lessons.map((l)=> ({...l, _pi: pi})))
      const l = all.find((x)=> x.id===lessonId)
      if (!l) { setLesson(null); return }
      setLesson(l)
      quizAutoRef.current = null
      const prog = await loadProgressAsync()
      if (prog[lessonId]?.passed) { setSubmitted(true); setScore(prog[lessonId].score || 100) }
      // Sequential lock guard: check previous lesson passed
      const idx = all.findIndex((x)=> x.id===lessonId)
      if (idx > 0) {
        const prev = all[idx-1]
        const prevProg = prog[prev.id]
        if (!prevProg?.passed) setLocked(true)
      }
    })()
  }, [lessonId, user?.id])

  const submit = async () => {
    if (!lesson || !assessmentId) return
    const result = await submitAssessment(assessmentId, answers)
    if (!result) {
      toast({ title: "Quiz submission failed", message: "Your answers could not be graded. Please retry.", kind: "error" })
      return
    }
    const { score: sc, passed } = result
    setScore(sc)
    setSubmitted(true)
    setGradeResults(result.results)
    setWeakInsight(null)
    const progress = loadProgress()
    progress[lessonId] = { completed: true, passed: progress[lessonId]?.passed === true || passed, score: sc }
    saveProgress(progress)
    trackEvent(passed ? "quiz_passed" : "quiz_failed", { score: sc })
    void loadGamAsync()
    void loadProgressAsync()
    if (passed) {
      setCreatureMsg("Quiz passed! Next lesson unlocked.")
      void deleteQuizBank(lessonId).then((ok) => {
        if (!ok) console.warn("[lesson] server bank delete failed")
      })
    }
  }

  const retryStandard = () => {
    setQuizMode("standard")
    setSubmitted(false)
    setAnswers({})
    setGradeResults([])
    void generateQuiz()
  }

  const loadRemedial = async () => {
    setVariantLoading(true)
    const issued = await requestQuiz(lessonId, "remedial")
    setVariantLoading(false)
    if (issued) {
      setActiveQuiz(issued.quiz)
      setAssessmentId(issued.assessmentId)
      setAnswers({})
      setSubmitted(false)
      setGradeResults([])
      setQuizMode("remedial")
    }
  }

  const loadChallenge = async () => {
    if (!submitted || score < V2_MASTERY_THRESHOLD) {
      toast({ title: "Master this lesson first", message: `Score at least ${V2_MASTERY_THRESHOLD}% before unlocking the challenge quiz.`, kind: "error" })
      return
    }
    setChallengeLoading(true)
    const issued = await requestQuiz(lessonId, "challenge")
    setChallengeLoading(false)
    if (issued) setChallenge({ assessmentId: issued.assessmentId, quiz: issued.quiz, answers: {}, submitted: false, score: 0 })
  }

  const submitChallenge = async () => {
    if (!challenge || !lesson) return
    const result = await submitAssessment(challenge.assessmentId, challenge.answers)
    if (!result) {
      toast({ title: "Challenge submission failed", message: "Your answers could not be graded. Please retry.", kind: "error" })
      return
    }
    setChallenge({ ...challenge, submitted: true, score: result.score, results: result.results })
  }

  // AI remediation for failures: fetched after submit, rendered inline below.
  // (Above all early returns — hooks must run unconditionally.)
  // Below the mastery target, offer an explanation even when the learner passed.
  useEffect(() => {
    if (!submitted || score >= V2_MASTERY_THRESHOLD || weakInsight || insightLoading) return
    setInsightLoading(true)
    void (async () => {
      try {
        const res = await fetch("/api/me/weakness-insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId, score }),
        })
        if (res.ok) {
          const data = (await res.json()) as { suggestion?: string }
          if (data.suggestion) setWeakInsight(data.suggestion)
        }
      } catch {
        // insight is a bonus — the fail panel stands without it
      } finally {
        setInsightLoading(false)
      }
    })()
  }, [submitted, score, weakInsight, insightLoading, lessonId])

  const updateCachedLesson = (patch: Partial<Lesson>) => {
    setLesson((prev) => (prev ? { ...prev, ...patch } : prev))
    const cached = loadRoadmap()
    if (cached) {
      saveRoadmap({
        ...cached,
        phases: cached.phases.map((p) => ({
          ...p,
          lessons: p.lessons.map((x) => (x.id === lessonId ? { ...x, ...patch } : x)),
        })),
      })
    }
  }

  const generateContent = async (regenerate: boolean) => {
    if (!lesson || contentLoading) return
    setConfirmRegen(false)
    setContentLoading(true)
    setContentError(null)
    setContentStatus("Starting…")
    const controller = new AbortController()
    contentAbortRef.current = controller
    try {
      const gen = await requestLessonContent(lessonId, regenerate)
      if (!gen) throw new Error("Lesson generation is temporarily unavailable. Please try again.")
      if ("contentMd" in gen) {
        updateCachedLesson({ contentMd: gen.contentMd, exampleCode: gen.exampleCode })
        trackEvent("lesson_generated", { cached: true })
        return
      }
      // Async job (1-3 min): poll with live progress, then refresh from server
      setContentStatus("Generating lesson… (usually 1–3 min)")
      await waitForJob(gen.jobId, {
        timeoutMs: 600000,
        signal: controller.signal,
        onProgress: (ms) => setContentStatus(`Generating lesson… (${Math.round(ms / 1000)}s elapsed)`),
      })
      const refreshed = await loadRoadmapAsync()
      const updated = refreshed?.phases.flatMap((p) => p.lessons).find((x) => x.id === lessonId)
      if (updated && !needsRealContent(updated.contentMd)) {
        setLesson(updated)
        trackEvent("lesson_generated", {})
      } else {
        throw new Error("Lesson content isn't ready yet. Please try again.")
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setContentError("Generation cancelled. You can retry anytime.")
      } else {
        setContentError(e instanceof Error ? friendlyGenerationError(e.message) : "Lesson generation failed. Please try again.")
      }
    } finally {
      contentAbortRef.current = null
      setContentLoading(false)
    }
  }

  const [quizStatus, setQuizStatus] = useState("")
  // Auto-generate the quiz once lesson content is ready (manual button stays
  // as retry). Guarded per-lesson so polling updates can't retrigger it.
  // Manual quiz generation only — never auto-generate on revisit.
  const generateQuiz = async () => {
    if (!lesson || quizLoading) return
    setQuizLoading(true)
    setQuizStatus("Starting quiz generation…")
    try {
      const issued = await requestQuiz(lessonId, "standard", (msg) => setQuizStatus(msg))
      if (issued) {
        setActiveQuiz(issued.quiz)
        setAssessmentId(issued.assessmentId)
        setAnswers({})
        setSubmitted(false)
        setGradeResults([])
        setQuizStatus("")
      } else {
        toast({ title: "Quiz unavailable", message: "Quiz generation is temporarily unavailable. Please try again.", kind: "error" })
        setQuizStatus("")
      }
    } finally {
      setQuizLoading(false)
    }
  }

  if (!mounted || lesson === undefined) return <div className="flex min-h-screen bg-app"><Sidebar/><div className="flex-1 flex flex-col min-w-0"><Header/><main className="p-8 max-w-4xl mx-auto w-full"><div className="animate-pulse space-y-4"><div className="h-8 bg-muted rounded w-1/3"/><div className="h-64 bg-muted rounded"/><div className="h-32 bg-muted rounded"/></div></main></div></div>
  if (!lesson) return <div className="flex min-h-screen bg-app"><Sidebar/><div className="flex-1 flex flex-col min-w-0"><Header/><main className="p-8">Lesson not found <Link href="/roadmap" className="text-primary">Go back</Link></main></div></div>
  if (locked && !submitted) return <div className="flex min-h-screen bg-app"><Sidebar/><div className="flex-1 flex flex-col min-w-0"><Header/><main className="p-8 max-w-4xl mx-auto w-full text-center"><div className="bg-card rounded-2xl border border-border p-12"><div className="mb-4 flex justify-center"><IconBadge icon={Lock} size="lg" tone="muted" /></div><h1 className="text-xl font-bold">Lesson locked</h1><p className="text-sm text-muted-foreground mt-2">Pass the previous lesson quiz ({LESSON_PASS_THRESHOLD}%+) to unlock this lesson. Mastery is tracked separately from progression.</p><Link href="/roadmap"><Button className="mt-6">Back to Roadmap →</Button></Link></div></main></div></div>

  const passed = score >= LESSON_PASS_THRESHOLD
  const metMasteryTarget = score >= V2_MASTERY_THRESHOLD
  const contentReady = !needsRealContent(lesson.contentMd)
  const quizReady = activeQuiz.length > 0 && !!assessmentId

  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-4 sm:p-6 max-w-4xl mx-auto w-full">
          <PageTransition>
          <Link href="/roadmap" className="text-sm text-muted-foreground">← Back to Roadmap</Link>
          <h1 className="t-title mt-3">{lesson.title}</h1>
          {lesson.estimatedMinutes ? (
            <div className="flex gap-2 mt-2">
              <span className="text-[11px] font-medium text-muted-foreground bg-muted border border-border rounded-full px-2.5 py-1">~{lesson.estimatedMinutes} min</span>
              <span className="text-[11px] font-medium text-info-fg bg-info-bg border border-info-border rounded-full px-2.5 py-1">Week {lesson.phaseIdx}</span>
            </div>
          ) : null}

          <Card className="p-6 mt-6 max-w-none">
            {!contentReady ? (
              <div className="text-center py-8">
                <div className="mb-3 flex justify-center"><IconBadge icon={BookOpen} size="lg" tone="info" /></div>
                <h3 className="font-semibold">Lesson content not generated yet</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">Generate a full in-depth lesson personalized to your level and learning style.</p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button onClick={() => void generateContent(false)} disabled={contentLoading}>
                    {contentLoading ? (contentStatus || "Generating…") : "Generate lesson →"}
                  </Button>
                  {contentLoading && (
                    <Button variant="outline" size="sm" onClick={() => contentAbortRef.current?.abort()}>
                      Cancel
                    </Button>
                  )}
                </div>
                {contentError && <p className="text-xs text-danger-fg mt-3 max-w-md mx-auto">{contentError}</p>}
              </div>
            ) : (
              <>
                {isLessonContent(lesson.contentJson) ? (
                  <div className="mb-3 inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-ok-bg text-ok-fg border border-ok-border">Validated content</div>
                ) : null}
                {isLessonContent(lesson.contentJson) ? (
                  <LessonBody doc={lesson.contentJson} lessonId={lessonId} />
                ) : (
                  <>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{lesson.contentMd}</div>
                    <div className="mt-6">
                      <div className="text-xs font-semibold text-muted-foreground mb-2">EXAMPLE</div>
                      <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-xl overflow-x-auto text-sm"><code>{lesson.exampleCode}</code></pre>
                    </div>
                  </>
                )}
                <div className="mt-4 flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setConfirmRegen(true)} disabled={contentLoading} className="gap-2">
                    <RefreshCw className={`w-3.5 h-3.5 ${contentLoading ? "animate-spin" : ""}`} />
                    {contentLoading ? (contentStatus || "Regenerating…") : "Regenerate lesson"}
                  </Button>
                </div>
                {contentError && <p className="text-xs text-danger-fg mt-2 text-right">{contentError}</p>}
                <ConfirmDialog
                  open={confirmRegen}
                  title="Regenerate lesson?"
                  description="Your current lesson content will be replaced with a freshly generated version."
                  confirmLabel="Regenerate"
                  busy={contentLoading}
                  onConfirm={()=> void generateContent(true)}
                  onClose={()=> { if (!contentLoading) setConfirmRegen(false) }}
                />
              </>
            )}
          </Card>

          <Card className="p-6 mt-6">
            <h3 className="font-semibold">Quiz — pass {LESSON_PASS_THRESHOLD}% to unlock next lesson{quizMode === "remedial" ? " · easier set" : ""}</h3>
            <p className="text-xs text-muted-foreground mt-1">Questions generated for this lesson content. Sequential gating: finish + pass to unlock next.</p>
            {quizLoading && (
              <div className="mt-2 flex items-center gap-2">
                <p className="text-xs text-primary">{quizStatus || "Generating a fresh quiz for this lesson…"}</p>
                <Button variant="outline" size="sm" onClick={() => { setQuizLoading(false); setQuizStatus("") }}>Cancel</Button>
              </div>
            )}
            <motion.div className="mt-4 space-y-6" variants={staggerParent} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-50px" }}>
              {quizReady && activeQuiz.map((q,i)=>(
                <motion.div key={i} variants={staggerChild} className="border border-border rounded-xl p-4">
                  <div className="font-medium text-sm">{i+1}. <QuizRichText text={q.q} draftKey={`quiz:${lessonId}:q${i}`} /></div>
                  <div className="grid gap-2 mt-3">
                    {q.options.map((opt, oi)=>(
                      <motion.label key={oi} whileTap={{ scale: 0.98 }} animate={submitted && gradeResults[i]?.correct && answers[i]===oi ? { scale: [1, 1.03, 1] } : {}} transition={{ duration: 0.35 }} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer text-sm ${answers[i]===oi? "border-primary bg-info-bg":"bg-card"}`}>
                        <input type="radio" name={`q-${i}`} checked={answers[i]===oi} onChange={()=>!submitted && setAnswers({...answers, [i]: oi})} /> <span className="flex-1 min-w-0"><QuizRichText text={opt} interactive={false} /></span>
                      </motion.label>
                    ))}
                  </div>
                  {submitted && <div className={`mt-2 text-xs flex items-center gap-1 ${gradeResults[i]?.correct ? "text-emerald-600" : "text-danger-fg"}`}>{gradeResults[i]?.correct ? <><Check className="w-3.5 h-3.5" /> Correct</> : <><X className="w-3.5 h-3.5" /> Wrong</>} — <QuizRichText text={gradeResults[i]?.explanation ?? q.explanation} draftKey={`quiz:${lessonId}:e${i}`} /></div>}
                </motion.div>
              ))}
            </motion.div>
            {submitted && gradeResults.some((result) => !result.correct) && (
              <section className="mt-5 rounded-xl border border-warn-border bg-warn-bg p-4" aria-label="Review missed concepts">
                <h4 className="text-sm font-semibold text-warn-fg">Focus your review</h4>
                <p className="mt-1 text-xs text-muted-foreground">Revisit these questions and explanations before your next attempt.</p>
                <ul className="mt-3 space-y-3">
                  {activeQuiz.map((question, index) => {
                    const result = gradeResults[index]
                    if (!result || result.correct) return null
                    return (
                      <li key={index} className="border-t border-warn-border pt-3 first:border-0 first:pt-0">
                        <p className="text-sm font-medium">{question.q}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{result.explanation}</p>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
            {!submitted ? (
              quizReady ? (
                <Button onClick={() => void submit()} className="mt-4" disabled={quizLoading || variantLoading || !assessmentId || Object.keys(answers).length < activeQuiz.length}>Submit Quiz</Button>
              ) : contentReady ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">{passed ? "You've passed this lesson — generate a fresh quiz to practice again." : "No quiz for this lesson yet. Generate one tailored to the lesson content above."}</p>
                  <Button onClick={() => void generateQuiz()} disabled={quizLoading} className="mt-4">
                    {quizLoading ? "Generating quiz…" : "Generate quiz →"}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-4">Generate the lesson above first — its quiz is built from the lesson content.</p>
              )
            ) :
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 22 }} className={`relative mt-4 p-4 rounded-xl ${passed?"bg-ok-bg border border-ok-border":"bg-danger-bg border border-danger-border"}`}>
                {passed && <ConfettiBurst fireKey={lessonId} />}
                <div className="font-semibold">{passed ? <>Passed! <AnimatedNumber value={score} format={(s) => `${s}%`} /></> : `Try again — ${score}%`}</div>
                <p className="text-sm mt-1">{passed
                  ? metMasteryTarget
                    ? `Great job! You reached the mastery target and unlocked the next lesson. +20 XP`
                    : `Passed — next lesson unlocked. Reach ${V2_MASTERY_THRESHOLD}% mastery with practice and review. +20 XP`
                  : `You need ${LESSON_PASS_THRESHOLD}% to unlock next. Review the lesson and retry.`}</p>
                {passed ? (
                  <div>
                    <Link href="/roadmap"><Button size="sm" className="mt-3">Continue to Roadmap →</Button></Link>
                    {!challenge && (
                      <Button size="sm" variant="outline" className="mt-3 ml-2" onClick={()=> void loadChallenge()} disabled={challengeLoading}>
                        {challengeLoading ? "Preparing…" : "Try challenge set"}
                      </Button>
                    )}
                    {challenge && (
                      <div className="mt-6 border-t border-ok-border pt-6">
                        <h4 className="font-semibold text-sm">Challenge set — practice only, no XP at stake</h4>
                        <div className="mt-4 space-y-4">
                          {challenge.quiz.map((q,i)=>(
                            <div key={i} className="border border-border rounded-xl p-4 bg-card">
                              <div className="font-medium text-sm">{i+1}. <QuizRichText text={q.q} draftKey={`quiz:${lessonId}:c${i}`} /></div>
                              <div className="grid gap-2 mt-3">
                                {q.options.map((opt, oi)=>(
                                  <motion.label key={oi} whileTap={{ scale: 0.98 }} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer text-sm ${challenge.answers[i]===oi ? "border-primary bg-info-bg" : "bg-card"}`}>
                                    <input type="radio" name={`c-${i}`} checked={challenge.answers[i]===oi} onChange={()=>!challenge.submitted && setChallenge({ ...challenge, answers: { ...challenge.answers, [i]: oi } })} /> <span className="flex-1 min-w-0"><QuizRichText text={opt} interactive={false} /></span>
                                  </motion.label>
                                ))}
                              </div>
                              {challenge.submitted && <div className={`mt-2 text-xs flex items-center gap-1 ${challenge.results?.[i]?.correct ? "text-emerald-600" : "text-danger-fg"}`}>{challenge.results?.[i]?.correct ? <><Check className="w-3.5 h-3.5" /> Correct</> : <><X className="w-3.5 h-3.5" /> Wrong</>} — <QuizRichText text={challenge.results?.[i]?.explanation ?? q.explanation} draftKey={`quiz:${lessonId}:ce${i}`} /></div>}
                            </div>
                          ))}
                        </div>
                        {!challenge.submitted ? (
                          <Button size="sm" variant="outline" className="mt-4" onClick={() => void submitChallenge()} disabled={Object.keys(challenge.answers).length < challenge.quiz.length}>Submit Challenge</Button>
                        ) : (
                          <div className="mt-4 text-sm">
                            <span className="font-semibold">{challenge.score >= 60 ? `Nice — ${challenge.score}%` : `Scored ${challenge.score}% — review the lesson and try again`}</span>
                            <button onClick={()=> setChallenge(null)} className="ml-3 text-xs text-primary underline min-h-[44px] inline-flex items-center px-2">Dismiss</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={retryStandard}>Retry Quiz</Button>
                    <Button size="sm" variant="outline" onClick={()=> void loadRemedial()} disabled={variantLoading || quizLoading}>
                      {variantLoading ? "Preparing…" : quizMode === "remedial" ? "Regenerate easier set" : "Practice easier set"}
                    </Button>
                  </div>
                )}
                {!passed && <div className="mt-3 text-xs bg-card border border-border rounded-lg p-3"><b>AI Mentor suggestion:</b> I recommend revisiting &ldquo;{lesson.title}&rdquo; fundamentals. <button onClick={()=>{ setRemedialMsg("Remedial suggestion saved! Your mentor will adapt your roadmap."); try { localStorage.setItem("hipath_tutor_prefill", `Help me with ${lesson.title} — I scored ${score}%`); localStorage.setItem("hipath_tutor_lessonId", lessonId) } catch{} }} className="text-primary underline">Ask mentor for help →</button>{remedialMsg && <div className="mt-2 text-ok-fg">{remedialMsg}</div>}</div>}
                {!passed && (insightLoading ? (
                  <div className="mt-3 text-xs bg-card border border-border rounded-lg p-3 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />Analyzing your mistake…</div>
                ) : weakInsight ? (
                  <div className="mt-3 text-xs bg-card border border-border rounded-lg p-3"><b>AI analysis:</b> {weakInsight}</div>
                ) : null)}
              </motion.div>
            }
          </Card>
          {creatureMsg && <Creature mode="burst" message={creatureMsg} open onClose={() => setCreatureMsg(null)} />}
          {lesson && isCapstoneTitle(lesson.title) && (
            <CapstoneEvidencePanel roadmapId={roadmapId} lessonId={lessonId} lessonTitle={lesson.title} />
          )}
          </PageTransition>
        </main>
      </div>
    </div>
  )
}
