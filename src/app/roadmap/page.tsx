"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { generateMockRoadmap } from "@/lib/mockData"
import { loadRoadmap, saveRoadmap, loadProgress } from "@/lib/store"
import Link from "next/link"
import { Check, Lock, Play } from "lucide-react"
import { motion } from "framer-motion"

export default function RoadmapPage() {
  const [roadmap, setRoadmap] = useState<any>(undefined)
  const [progress, setProgress] = useState<Record<string,any>>({})
  const [mounted, setMounted] = useState(false)
  useEffect(()=>{
    setMounted(true)
    const r = loadRoadmap()
    setRoadmap(r)
    setProgress(loadProgress())
  }, [])

  if (!mounted || roadmap === undefined) {
    return (
      <div className="flex min-h-screen bg-gray-50 dark:bg-zinc-950">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0"><Header />
          <main className="p-8 max-w-7xl w-full mx-auto">
            <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 dark:bg-zinc-800 rounded w-1/3"/><div className="h-32 bg-gray-200 dark:bg-zinc-800 rounded"/><div className="h-64 bg-gray-200 dark:bg-zinc-800 rounded"/></div>
          </main>
        </div>
      </div>
    )
  }
  if (roadmap === null) {
    return (
      <div className="flex min-h-screen bg-gray-50 dark:bg-zinc-950">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0"><Header />
          <main className="p-8 max-w-7xl w-full mx-auto">
            <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border dark:border-zinc-800">
              <div className="w-16 h-16 rounded-2xl bg-[#6C5BFF]/10 flex items-center justify-center mx-auto mb-4 text-2xl">🗺️</div>
              <h2 className="text-xl font-bold">No roadmap yet</h2>
              <p className="text-sm text-zinc-500 mt-2 max-w-md mx-auto">Create your first personalized roadmap — tell us your goal, level, and time, and HiPath AI will build a structured, adaptive plan.</p>
              <Link href="/onboarding"><Button className="mt-6">Create Roadmap →</Button></Link>
            </div>
          </main>
        </div>
      </div>
    )
  }
  const allLessons = roadmap.phases.flatMap((p:any)=> p.lessons)
  const done = Object.values(progress).filter((p:any)=>p.completed).length
  const total = allLessons.length
  const pct = Math.round((done/total)*100)

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-zinc-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <div className="text-sm text-zinc-500 mb-2">Dashboard &gt; Roadmap</div>
          <div className="flex justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl font-bold">{roadmap.title}</h1>
              <p className="text-sm text-zinc-500 mt-1">{roadmap.description}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Edit</Button>
              <Button variant="outline" size="sm">Pause</Button>
              <Button variant="outline" size="sm" className="text-red-600 border-red-200">Delete</Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6">
            <Card className="p-4 text-center"><div className="text-[#6C5BFF] font-bold text-lg">{pct}%</div><div className="text-xs text-zinc-500">Complete</div></Card>
            <Card className="p-4 text-center"><div className="font-bold text-lg">{total - done}</div><div className="text-xs text-zinc-500">Lessons remaining</div></Card>
            <Card className="p-4 text-center"><div className="font-bold text-lg">0 days</div><div className="text-xs text-zinc-500">Current streak</div></Card>
          </div>

          <div className="mt-6 space-y-8">
            {roadmap.phases.map((phase:any, pi:number)=>{
              const isUnlockedPhase = pi===0 || roadmap.phases[pi-1].lessons.every((l:any)=> progress[l.id]?.completed && progress[l.id]?.passed)
              return (
                <motion.div key={phase.id} initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay: pi*0.08}}>
                  <h3 className="font-semibold mb-3">{phase.title}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    {phase.lessons.map((lesson:any, idx:number)=>{
                      const isFirstOverall = pi===0 && idx===0
                      const prevLesson = idx>0 ? phase.lessons[idx-1] : (pi>0 ? roadmap.phases[pi-1].lessons[roadmap.phases[pi-1].lessons.length-1] : null)
                      const prevDone = !prevLesson || (progress[prevLesson.id]?.completed && progress[prevLesson.id]?.passed)
                      const locked = !isFirstOverall && !prevDone
                      const completed = progress[lesson.id]?.completed
                      return (
                        <motion.div key={lesson.id} whileHover={!locked? {y:-2, scale:1.02}: {}} transition={{type:"spring", stiffness:300}}>
                        <Link href={locked ? "#" : `/roadmap/${roadmap.id}/lesson/${lesson.id}`} className={`rounded-xl border p-4 flex flex-col items-center text-center gap-2 transition ${locked?"bg-gray-100 dark:bg-zinc-800 opacity-60 cursor-not-allowed": completed?"bg-emerald-50 border-emerald-200 dark:bg-emerald-950":"bg-white dark:bg-zinc-900 hover:border-[var(--primary)] hover:shadow-md"}`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${completed?"bg-emerald-500 text-white": locked?"bg-gray-300 text-white":"bg-[var(--primary)] text-white"}`}>{completed? <Check className="w-5 h-5"/> : locked? <Lock className="w-4 h-4"/> : lesson.idx}</div>
                          <div className="text-xs font-medium leading-tight line-clamp-2">{lesson.title}</div>
                          <div className="text-[11px] text-zinc-500">{locked? "Locked" : completed? "Completed" : "Start →"}</div>
                        </Link>
                        </motion.div>
                      )
                    })}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </main>
      </div>
    </div>
  )
}
