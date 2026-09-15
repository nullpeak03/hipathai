"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { loadRoadmap, loadProgress, saveProgress, loadGam, saveGam } from "@/lib/store"
import Link from "next/link"

export default function LessonPage() {
  const { lessonId } = useParams() as { lessonId: string }
  const router = useRouter()
  const [lesson, setLesson] = useState<any>(undefined)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(()=>{
    setMounted(true)
    const rm = loadRoadmap()
    if (!rm) { setLesson(null); return }
    const all = rm.phases.flatMap((p:any)=>p.lessons)
    const l = all.find((x:any)=> x.id===lessonId)
    setLesson(l || null)
    const prog = loadProgress()
    if (prog[lessonId]?.passed) setSubmitted(true)
  }, [lessonId])

  const submit = () => {
    if (!lesson) return
    let correct=0
    lesson.quiz.forEach((q:any,i:number)=> { if (answers[i]===q.correct) correct++ })
    const sc = Math.round((correct/lesson.quiz.length)*100)
    setScore(sc)
    setSubmitted(true)
    const passed = sc >= 60
    const prog = loadProgress()
    prog[lessonId] = { completed: true, passed, score: sc }
    saveProgress(prog)
    if (passed) {
      const gam = loadGam()
      const newGam = { ...gam, xp: (gam.xp||0)+20, lessonsDone: (gam.lessonsDone||0)+1, streak: (gam.streak||0) }
      // level calc simple
      const thresholds = [0,100,300,600,1000]
      let lvl=1; for(let i=thresholds.length-1;i>=0;i--) if(newGam.xp>=thresholds[i]) {lvl=i+1;break}
      ;(newGam as any).level=lvl
      saveGam(newGam as any)
    }
    // trigger adapt suggestion if failed
    if (!passed) {
      // store weak topic flag
    }
  }

  if (!mounted || lesson === undefined) return <div className="flex min-h-screen bg-gray-50 dark:bg-zinc-950"><Sidebar/><div className="flex-1 flex flex-col min-w-0"><Header/><main className="p-8 max-w-4xl mx-auto w-full"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 dark:bg-zinc-800 rounded w-1/3"/><div className="h-64 bg-gray-200 dark:bg-zinc-800 rounded"/><div className="h-32 bg-gray-200 dark:bg-zinc-800 rounded"/></div></main></div></div>
  if (!lesson) return <div className="flex min-h-screen"><Sidebar/><div className="flex-1 p-8">Lesson not found <Link href="/roadmap" className="text-[#6C5BFF]">Go back</Link></div></div>

  const passed = score >=60

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-zinc-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-4 sm:p-6 max-w-4xl mx-auto w-full">
          <Link href="/roadmap" className="text-sm text-zinc-500">← Back to Roadmap</Link>
          <h1 className="text-2xl font-bold mt-3">{lesson.title}</h1>

          <Card className="p-6 mt-6 prose dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{lesson.contentMd}</div>
            <div className="mt-6">
              <div className="text-xs font-semibold text-zinc-500 mb-2">EXAMPLE (mock code block — no execution in V1)</div>
              <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-xl overflow-x-auto text-sm"><code>{lesson.exampleCode}</code></pre>
            </div>
          </Card>

          <Card className="p-6 mt-6">
            <h3 className="font-semibold">Quiz — pass 60% to unlock next lesson</h3>
            <p className="text-xs text-zinc-500 mt-1">Sequential gating: finish lesson + pass quiz to unlock next.</p>
            <div className="mt-4 space-y-6">
              {lesson.quiz.map((q:any,i:number)=>(
                <div key={i} className="border dark:border-zinc-800 rounded-xl p-4">
                  <div className="font-medium text-sm">{i+1}. {q.q}</div>
                  <div className="grid gap-2 mt-3">
                    {q.options.map((opt:string, oi:number)=>(
                      <label key={oi} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer text-sm ${answers[i]===oi? "border-[#6C5BFF] bg-violet-50 dark:bg-violet-950":"bg-white dark:bg-zinc-900"}`}>
                        <input type="radio" name={`q-${i}`} checked={answers[i]===oi} onChange={()=>!submitted && setAnswers({...answers, [i]: oi})} /> {opt}
                      </label>
                    ))}
                  </div>
                  {submitted && <div className={`mt-2 text-xs ${answers[i]===q.correct?"text-emerald-600":"text-red-600"}`}>{answers[i]===q.correct? "✓ Correct":"✗ Wrong"} — {q.explanation}</div>}
                </div>
              ))}
            </div>
            {!submitted ? <Button onClick={submit} className="mt-4" disabled={Object.keys(answers).length < lesson.quiz.length}>Submit Quiz</Button> :
              <div className={`mt-4 p-4 rounded-xl ${passed?"bg-emerald-50 border border-emerald-200 dark:bg-emerald-950":"bg-red-50 border border-red-200 dark:bg-red-950"}`}>
                <div className="font-semibold">{passed? `Passed! ${score}%` : `Try again — ${score}%`}</div>
                <p className="text-sm mt-1">{passed? "Great job! Next lesson unlocked. +20 XP" : "You need 60% to unlock next. Review the lesson and retry."}</p>
                {passed ? <Link href="/roadmap"><Button size="sm" className="mt-3">Continue to Roadmap →</Button></Link> : <Button size="sm" variant="outline" className="mt-3" onClick={()=>{setSubmitted(false); setAnswers({})}}>Retry Quiz</Button>}
                {!passed && <div className="mt-3 text-xs bg-white dark:bg-zinc-900 border rounded-lg p-3"><b>AI Mentor suggestion:</b> I recommend revisiting "{lesson.title}" fundamentals. Need a remedial dive? <button className="text-[#6C5BFF] underline">Add remedial lesson (Hybrid: Suggest Adapt)</button></div>}
              </div>
            }
          </Card>
        </main>
      </div>
    </div>
  )
}
