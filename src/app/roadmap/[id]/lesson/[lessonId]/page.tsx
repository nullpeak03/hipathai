"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { loadRoadmap, loadRoadmapAsync, loadProgress, saveProgress, saveRoadmap, loadGam, saveGam, supabaseSaveGam, supabaseSaveProgress, supabaseSaveQuizAttempt, logStudySession, requestQuiz, requestLessonContent, waitForJob, type Gamification } from "@/lib/store"
import type { Lesson, QuizQuestion } from "@/lib/mockData"
import { needsRealQuiz } from "@/lib/quiz"
import { needsRealContent } from "@/lib/lesson-content"
import { friendlyGenerationError } from "@/lib/generation-errors"
import { getLevel } from "@/lib/gamification"
import { useUser } from "@clerk/nextjs"
import { useToast } from "@/components/ui/toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { trackEvent } from "@/components/analytics/posthog-provider"
import Link from "next/link"

export default function LessonPage() {
  const { lessonId } = useParams() as { lessonId: string }
  const { user } = useUser()
  const toast = useToast()
  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [locked, setLocked] = useState(false)
  const [remedialMsg, setRemedialMsg] = useState("")
  const [quizLoading, setQuizLoading] = useState(false)
  const [contentLoading, setContentLoading] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [contentStatus, setContentStatus] = useState("")
  const [contentError, setContentError] = useState<string | null>(null)
  const [weakInsight, setWeakInsight] = useState<string | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [quizMode, setQuizMode] = useState<"standard" | "remedial">("standard")
  const [variantLoading, setVariantLoading] = useState(false)
  const [challenge, setChallenge] = useState<{ quiz: QuizQuestion[]; answers: Record<number, number>; submitted: boolean; score: number } | null>(null)
  const [challengeLoading, setChallengeLoading] = useState(false)
  const enteredAtRef = useRef(Date.now())

  useEffect(()=>{
    setMounted(true)
    // Reset per-lesson UI state when navigating between lessons
    setSubmitted(false)
    setAnswers({})
    setScore(0)
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
      const prog = loadProgress()
      // Note: quiz generation is button-driven (no auto-fetch) — the learner
      // generates the lesson first, then its quiz.
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

  const submit = () => {
    if (!lesson) return
    let correct=0
    lesson.quiz.forEach((q,i)=> { if (answers[i]===q.correct) correct++ })
    const sc = lesson.quiz.length ? Math.round((correct/lesson.quiz.length)*100) : 0
    setScore(sc)
    setSubmitted(true)
    setWeakInsight(null)
    const passed = sc >= 60
    const prog = loadProgress()
    const wasPassed = prog[lessonId]?.passed === true
    prog[lessonId] = { completed: true, passed, score: sc }
    saveProgress(prog)
    trackEvent(passed ? "quiz_passed" : "quiz_failed", { score: sc })
    // Log every attempt (pass or fail). The server bumps the lesson's weak
    // topic on failure — feeds analytics + dashboard weak-area chips.
    void supabaseSaveQuizAttempt(lessonId, answers, sc, passed, lesson.title)
    // Track real lesson dwell time for the analytics heatmap
    const dwellMin = Math.max(1, Math.min(180, Math.round((Date.now() - enteredAtRef.current) / 60000)))
    void logStudySession(dwellMin, passed ? 20 : 0, passed ? 1 : 0)
    // Update gamification: XP, lessonsDone, passRate, studyMinutes, streak
    const gam: Gamification = loadGam()
    const totalAttempts = Object.keys(prog).length
    const passedCount = Object.values(prog).filter((p)=>p.passed).length
    const passRate = totalAttempts ? Math.round((passedCount/totalAttempts)*100) : 0
    if (passed && !wasPassed) {
      const newXp = (gam.xp||0)+20
      const today = new Date().toDateString()
      const lastDay = gam.lastStudyDate
      let streak = gam.streak||0
      if (lastDay !== today) streak = streak+1 > 0 ? (lastDay ? streak+1 : 1) : 1
      // if already studied today, keep streak
      const newGam: Gamification = { ...gam, xp: newXp, level: getLevel(newXp), lessonsDone: (gam.lessonsDone||0)+1, passRate, studyMinutes: (gam.studyMinutes||0)+15, streak, bestStreak: Math.max(gam.bestStreak||0, streak), lastStudyDate: today }
      saveGam(newGam)
      // async Supabase sync (server derives identity; no-op when offline)
      void supabaseSaveGam(newGam)
      void supabaseSaveProgress(lessonId, true, sc)
    } else if (passed) {
      // Re-pass (practice sets): refresh the rate, never double-award XP
      const newGam: Gamification = { ...gam, passRate }
      saveGam(newGam)
    } else {
      const newGam: Gamification = { ...gam, passRate, studyMinutes: (gam.studyMinutes||0)+5 }
      saveGam(newGam)
      // store weak topic flag
      try {
        const topics = JSON.parse(localStorage.getItem("hipath_weak_topics") || "[]")
        if (!topics.includes(lesson.title)) {
          topics.push(lesson.title)
          localStorage.setItem("hipath_weak_topics", JSON.stringify(topics))
        }
      } catch {}
    }
  }

  const retryStandard = () => {
    // Restore the canonical stored quiz (remedial sets live in memory only)
    const cached = loadRoadmap()
    const canonical = cached?.phases.flatMap((p)=>p.lessons).find((x)=>x.id===lessonId)?.quiz
    if (canonical && lesson) setLesson({ ...lesson, quiz: canonical })
    setQuizMode("standard")
    setSubmitted(false)
    setAnswers({})
  }

  const loadRemedial = async () => {
    setVariantLoading(true)
    const quiz = await requestQuiz(lessonId, "remedial")
    setVariantLoading(false)
    if (quiz && lesson) {
      setLesson({ ...lesson, quiz })
      setAnswers({})
      setSubmitted(false)
      setQuizMode("remedial")
    }
  }

  const loadChallenge = async () => {
    setChallengeLoading(true)
    const quiz = await requestQuiz(lessonId, "challenge")
    setChallengeLoading(false)
    if (quiz) setChallenge({ quiz, answers: {}, submitted: false, score: 0 })
  }

  const submitChallenge = () => {
    if (!challenge || !lesson) return
    let correct = 0
    challenge.quiz.forEach((q, i) => { if (challenge.answers[i] === q.correct) correct++ })
    const sc = challenge.quiz.length ? Math.round((correct / challenge.quiz.length) * 100) : 0
    setChallenge({ ...challenge, submitted: true, score: sc })
    // Practice only: logged for analytics, never touches gating, XP, or streaks
    void supabaseSaveQuizAttempt(lessonId, challenge.answers, sc, sc >= 60, lesson.title)
  }

  // AI remediation for failures: fetched after submit, rendered inline below.
  // (Above all early returns — hooks must run unconditionally.)
  // Note: uses score >= 60 directly because `passed` is declared later.
  useEffect(() => {
    if (!submitted || score >= 60 || weakInsight || insightLoading) return
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
      setContentError(e instanceof Error ? friendlyGenerationError(e.message) : "Lesson generation failed. Please try again.")
    } finally {
      setContentLoading(false)
    }
  }

  const generateQuiz = async () => {
    if (!lesson || quizLoading) return
    setQuizLoading(true)
    try {
      const quiz = await requestQuiz(lessonId)
      if (quiz) {
        updateCachedLesson({ quiz })
        setAnswers({})
        setSubmitted(false)
      } else {
        toast({ title: "Quiz unavailable", message: "Quiz generation is temporarily unavailable. Please try again.", kind: "error" })
      }
    } finally {
      setQuizLoading(false)
    }
  }

  if (!mounted || lesson === undefined) return <div className="flex min-h-screen bg-app"><Sidebar/><div className="flex-1 flex flex-col min-w-0"><Header/><main className="p-8 max-w-4xl mx-auto w-full"><div className="animate-pulse space-y-4"><div className="h-8 bg-muted rounded w-1/3"/><div className="h-64 bg-muted rounded"/><div className="h-32 bg-muted rounded"/></div></main></div></div>
  if (!lesson) return <div className="flex min-h-screen bg-app"><Sidebar/><div className="flex-1 flex flex-col min-w-0"><Header/><main className="p-8">Lesson not found <Link href="/roadmap" className="text-primary">Go back</Link></main></div></div>
  if (locked && !submitted) return <div className="flex min-h-screen bg-app"><Sidebar/><div className="flex-1 flex flex-col min-w-0"><Header/><main className="p-8 max-w-4xl mx-auto w-full text-center"><div className="bg-card rounded-2xl border border-border p-12"><div className="text-4xl mb-4">🔒</div><h1 className="text-xl font-bold">Lesson locked</h1><p className="text-sm text-muted-foreground mt-2">Pass the previous lesson quiz (60%+) to unlock this lesson. Sequential gating keeps you on track.</p><Link href="/roadmap"><Button className="mt-6">Back to Roadmap →</Button></Link></div></main></div></div>

  const passed = score >=60
  const contentReady = !needsRealContent(lesson.contentMd)
  const quizReady = !needsRealQuiz(lesson.quiz)

  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-4 sm:p-6 max-w-4xl mx-auto w-full">
          <Link href="/roadmap" className="text-sm text-muted-foreground">← Back to Roadmap</Link>
          <h1 className="text-2xl font-bold mt-3">{lesson.title}</h1>

          <Card className="p-6 mt-6 max-w-none">
            {!contentReady ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📖</div>
                <h3 className="font-semibold">Lesson content not generated yet</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">Generate a full ~5-minute lesson personalized to your level and learning style.</p>
                <Button onClick={() => void generateContent(false)} disabled={contentLoading} className="mt-4">
                  {contentLoading ? (contentStatus || "Generating…") : "Generate lesson →"}
                </Button>
                {contentError && <p className="text-xs text-danger-fg mt-3 max-w-md mx-auto">{contentError}</p>}
              </div>
            ) : (
              <>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{lesson.contentMd}</div>
                <div className="mt-6">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">EXAMPLE</div>
                  <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-xl overflow-x-auto text-sm"><code>{lesson.exampleCode}</code></pre>
                </div>
                <div className="mt-4 text-right">
                  <button onClick={() => setConfirmRegen(true)} disabled={contentLoading} className="text-xs text-zinc-400 hover:text-foreground underline">
                    {contentLoading ? (contentStatus || "Regenerating…") : "Regenerate lesson"}
                  </button>
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
            <h3 className="font-semibold">Quiz — pass 60% to unlock next lesson{quizMode === "remedial" ? " · easier set" : ""}</h3>
            <p className="text-xs text-muted-foreground mt-1">Questions generated for this lesson content. Sequential gating: finish + pass to unlock next.</p>
            {quizLoading && <p className="text-xs text-primary mt-2">Generating a fresh quiz for this lesson…</p>}
            <div className="mt-4 space-y-6">
              {quizReady && lesson.quiz.map((q,i)=>(
                <div key={i} className="border border-border rounded-xl p-4">
                  <div className="font-medium text-sm">{i+1}. {q.q}</div>
                  <div className="grid gap-2 mt-3">
                    {q.options.map((opt, oi)=>(
                      <label key={oi} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer text-sm ${answers[i]===oi? "border-primary bg-info-bg":"bg-card"}`}>
                        <input type="radio" name={`q-${i}`} checked={answers[i]===oi} onChange={()=>!submitted && setAnswers({...answers, [i]: oi})} /> {opt}
                      </label>
                    ))}
                  </div>
                  {submitted && <div className={`mt-2 text-xs ${answers[i]===q.correct?"text-emerald-600":"text-danger-fg"}`}>{answers[i]===q.correct? "✓ Correct":"✗ Wrong"} — {q.explanation}</div>}
                </div>
              ))}
            </div>
            {!submitted ? (
              quizReady ? (
                <Button onClick={submit} className="mt-4" disabled={quizLoading || variantLoading || Object.keys(answers).length < lesson.quiz.length}>Submit Quiz</Button>
              ) : contentReady ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">No quiz for this lesson yet. Generate one tailored to the lesson content above.</p>
                  <Button onClick={() => void generateQuiz()} disabled={quizLoading} className="mt-4">
                    {quizLoading ? "Generating quiz…" : "Generate quiz →"}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-4">Generate the lesson above first — its quiz is built from the lesson content.</p>
              )
            ) :
              <div className={`mt-4 p-4 rounded-xl ${passed?"bg-ok-bg border border-ok-border":"bg-danger-bg border border-danger-border"}`}>
                <div className="font-semibold">{passed? `Passed! ${score}%` : `Try again — ${score}%`}</div>
                <p className="text-sm mt-1">{passed? "Great job! Next lesson unlocked. +20 XP" : "You need 60% to unlock next. Review the lesson and retry."}</p>
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
                              <div className="font-medium text-sm">{i+1}. {q.q}</div>
                              <div className="grid gap-2 mt-3">
                                {q.options.map((opt, oi)=>(
                                  <label key={oi} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer text-sm ${challenge.answers[i]===oi ? "border-primary bg-info-bg" : "bg-card"}`}>
                                    <input type="radio" name={`c-${i}`} checked={challenge.answers[i]===oi} onChange={()=>!challenge.submitted && setChallenge({ ...challenge, answers: { ...challenge.answers, [i]: oi } })} /> {opt}
                                  </label>
                                ))}
                              </div>
                              {challenge.submitted && <div className={`mt-2 text-xs ${challenge.answers[i]===q.correct ? "text-emerald-600" : "text-danger-fg"}`}>{challenge.answers[i]===q.correct ? "✓ Correct" : "✗ Wrong"} — {q.explanation}</div>}
                            </div>
                          ))}
                        </div>
                        {!challenge.submitted ? (
                          <Button size="sm" variant="outline" className="mt-4" onClick={submitChallenge} disabled={Object.keys(challenge.answers).length < challenge.quiz.length}>Submit Challenge</Button>
                        ) : (
                          <div className="mt-4 text-sm">
                            <span className="font-semibold">{challenge.score >= 60 ? `Nice — ${challenge.score}%` : `Scored ${challenge.score}% — review the lesson and try again`}</span>
                            <button onClick={()=> setChallenge(null)} className="ml-3 text-xs text-primary underline">Dismiss</button>
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
                {!passed && <div className="mt-3 text-xs bg-card border border-border rounded-lg p-3"><b>AI Mentor suggestion:</b> I recommend revisiting &ldquo;{lesson.title}&rdquo; fundamentals. <button onClick={()=>{ setRemedialMsg("Remedial suggestion saved! Your mentor will adapt your roadmap."); try { localStorage.setItem("hipath_tutor_prefill", `Help me with ${lesson.title} — I scored ${score}%`) } catch{} }} className="text-primary underline">Ask mentor for help →</button>{remedialMsg && <div className="mt-2 text-ok-fg">{remedialMsg}</div>}</div>}
                {!passed && (insightLoading ? (
                  <div className="mt-3 text-xs bg-card border border-border rounded-lg p-3">🔍 Analyzing your mistake…</div>
                ) : weakInsight ? (
                  <div className="mt-3 text-xs bg-card border border-border rounded-lg p-3"><b>AI analysis:</b> {weakInsight}</div>
                ) : null)}
              </div>
            }
          </Card>
        </main>
      </div>
    </div>
  )
}
