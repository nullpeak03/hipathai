"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { loadRoadmap, loadProgress, saveProgress, loadGam, saveGam, supabaseSaveGam, supabaseSaveProgress, type Gamification } from "@/lib/store"
import type { Lesson } from "@/lib/mockData"
import { getLevel } from "@/lib/gamification"
import { useUser } from "@clerk/nextjs"
import Link from "next/link"

export default function LessonPage() {
  const { lessonId } = useParams() as { lessonId: string }
  const { user } = useUser()
  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [locked, setLocked] = useState(false)
  const [remedialMsg, setRemedialMsg] = useState("")

  useEffect(()=>{
    setMounted(true)
    const rm = loadRoadmap()
    if (!rm) { setLesson(null); return }
    const all = rm.phases.flatMap((p, pi)=> p.lessons.map((l)=> ({...l, _pi: pi})))
    const l = all.find((x)=> x.id===lessonId)
    if (!l) { setLesson(null); return }
    setLesson(l)
    const prog = loadProgress()
    if (prog[lessonId]?.passed) { setSubmitted(true); setScore(prog[lessonId].score || 100) }
    // Sequential lock guard: check previous lesson passed
    const idx = all.findIndex((x)=> x.id===lessonId)
    if (idx > 0) {
      const prev = all[idx-1]
      const prevProg = prog[prev.id]
      if (!prevProg?.passed) setLocked(true)
    }
  }, [lessonId])

  const submit = () => {
    if (!lesson) return
    let correct=0
    lesson.quiz.forEach((q,i)=> { if (answers[i]===q.correct) correct++ })
    const sc = lesson.quiz.length ? Math.round((correct/lesson.quiz.length)*100) : 0
    setScore(sc)
    setSubmitted(true)
    const passed = sc >= 60
    const prog = loadProgress()
    prog[lessonId] = { completed: true, passed, score: sc }
    saveProgress(prog)
    // Update gamification: XP, lessonsDone, passRate, studyMinutes, streak
    const gam: Gamification = loadGam()
    const totalAttempts = Object.keys(prog).length
    const passedCount = Object.values(prog).filter((p)=>p.passed).length
    const passRate = totalAttempts ? Math.round((passedCount/totalAttempts)*100) : 0
    if (passed) {
      const newXp = (gam.xp||0)+20
      const today = new Date().toDateString()
      const lastDay = gam.lastStudyDate
      let streak = gam.streak||0
      if (lastDay !== today) streak = streak+1 > 0 ? (lastDay ? streak+1 : 1) : 1
      // if already studied today, keep streak
      const newGam: Gamification = { ...gam, xp: newXp, level: getLevel(newXp), lessonsDone: (gam.lessonsDone||0)+1, passRate, studyMinutes: (gam.studyMinutes||0)+15, streak, bestStreak: Math.max(gam.bestStreak||0, streak), lastStudyDate: today }
      saveGam(newGam)
      // async Supabase sync
      const uid = user?.id
      if (uid) {
        void supabaseSaveGam(uid, newGam)
        void supabaseSaveProgress(uid, lessonId, true, sc)
      }
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

  if (!mounted || lesson === undefined) return <div className="flex min-h-screen bg-gray-50"><Sidebar/><div className="flex-1 flex flex-col min-w-0"><Header/><main className="p-8 max-w-4xl mx-auto w-full"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/3"/><div className="h-64 bg-gray-200 rounded"/><div className="h-32 bg-gray-200 rounded"/></div></main></div></div>
  if (!lesson) return <div className="flex min-h-screen bg-gray-50"><Sidebar/><div className="flex-1 flex flex-col min-w-0"><Header/><main className="p-8">Lesson not found <Link href="/roadmap" className="text-[#6C5BFF]">Go back</Link></main></div></div>
  if (locked && !submitted) return <div className="flex min-h-screen bg-gray-50"><Sidebar/><div className="flex-1 flex flex-col min-w-0"><Header/><main className="p-8 max-w-4xl mx-auto w-full text-center"><div className="bg-white rounded-2xl border p-12"><div className="text-4xl mb-4">🔒</div><h1 className="text-xl font-bold">Lesson locked</h1><p className="text-sm text-zinc-500 mt-2">Pass the previous lesson quiz (60%+) to unlock this lesson. Sequential gating keeps you on track.</p><Link href="/roadmap"><Button className="mt-6">Back to Roadmap →</Button></Link></div></main></div></div>

  const passed = score >=60

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-4 sm:p-6 max-w-4xl mx-auto w-full">
          <Link href="/roadmap" className="text-sm text-zinc-500">← Back to Roadmap</Link>
          <h1 className="text-2xl font-bold mt-3">{lesson.title}</h1>

          <Card className="p-6 mt-6 max-w-none">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{lesson.contentMd}</div>
            <div className="mt-6">
              <div className="text-xs font-semibold text-zinc-500 mb-2">EXAMPLE</div>
              <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-xl overflow-x-auto text-sm"><code>{lesson.exampleCode}</code></pre>
            </div>
          </Card>

          <Card className="p-6 mt-6">
            <h3 className="font-semibold">Quiz — pass 60% to unlock next lesson</h3>
            <p className="text-xs text-zinc-500 mt-1">Real-time quiz generated for this lesson content. Sequential gating: finish + pass to unlock next.</p>
            <div className="mt-4 space-y-6">
              {lesson.quiz.map((q,i)=>(
                <div key={i} className="border rounded-xl p-4">
                  <div className="font-medium text-sm">{i+1}. {q.q}</div>
                  <div className="grid gap-2 mt-3">
                    {q.options.map((opt, oi)=>(
                      <label key={oi} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer text-sm ${answers[i]===oi? "border-[#6C5BFF] bg-violet-50":"bg-white"}`}>
                        <input type="radio" name={`q-${i}`} checked={answers[i]===oi} onChange={()=>!submitted && setAnswers({...answers, [i]: oi})} /> {opt}
                      </label>
                    ))}
                  </div>
                  {submitted && <div className={`mt-2 text-xs ${answers[i]===q.correct?"text-emerald-600":"text-red-600"}`}>{answers[i]===q.correct? "✓ Correct":"✗ Wrong"} — {q.explanation}</div>}
                </div>
              ))}
            </div>
            {!submitted ? <Button onClick={submit} className="mt-4" disabled={Object.keys(answers).length < lesson.quiz.length}>Submit Quiz</Button> :
              <div className={`mt-4 p-4 rounded-xl ${passed?"bg-emerald-50 border border-emerald-200":"bg-red-50 border border-red-200"}`}>
                <div className="font-semibold">{passed? `Passed! ${score}%` : `Try again — ${score}%`}</div>
                <p className="text-sm mt-1">{passed? "Great job! Next lesson unlocked. +20 XP" : "You need 60% to unlock next. Review the lesson and retry."}</p>
                {passed ? <Link href="/roadmap"><Button size="sm" className="mt-3">Continue to Roadmap →</Button></Link> : <Button size="sm" variant="outline" className="mt-3" onClick={()=>{setSubmitted(false); setAnswers({})}}>Retry Quiz</Button>}
                {!passed && <div className="mt-3 text-xs bg-white border rounded-lg p-3"><b>AI Mentor suggestion:</b> I recommend revisiting &ldquo;{lesson.title}&rdquo; fundamentals. <button onClick={()=>{ setRemedialMsg("Remedial suggestion saved! Your mentor will adapt your roadmap."); try { localStorage.setItem("hipath_tutor_prefill", `Help me with ${lesson.title} — I scored ${score}%`) } catch{} }} className="text-[#6C5BFF] underline">Ask mentor for help →</button>{remedialMsg && <div className="mt-2 text-emerald-600">{remedialMsg}</div>}</div>}
              </div>
            }
          </Card>
        </main>
      </div>
    </div>
  )
}
