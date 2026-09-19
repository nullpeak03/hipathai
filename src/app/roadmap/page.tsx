"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { loadRoadmap, clearRoadmap, loadProgress, loadGam, type RoadmapData, type Progress } from "@/lib/store"
import type { Lesson, Phase } from "@/lib/mockData"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, Lock, ChevronDown, LayoutGrid, List } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export default function RoadmapPage() {
  const router = useRouter()
  const [roadmap, setRoadmap] = useState<RoadmapData | null | undefined>(undefined)
  const [progress, setProgress] = useState<Progress>({})
  const [gam, setGam] = useState({ streak: 0 })
  const [mounted, setMounted] = useState(false)
  const [viewMode, setViewMode] = useState<"grid"|"list">("grid")
  const [openPhases, setOpenPhases] = useState<Record<string,boolean>>({})

  useEffect(()=>{
    setMounted(true)
    setRoadmap(loadRoadmap())
    setProgress(loadProgress())
    setGam(loadGam())
    const vm = localStorage.getItem("hipath_viewMode") as "grid" | "list" | null
    if (vm) setViewMode(vm)
  }, [])
  useEffect(()=> { if (mounted) localStorage.setItem("hipath_viewMode", viewMode) }, [viewMode, mounted])

  if (!mounted || roadmap === undefined) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0"><Header />
          <main className="p-8 max-w-7xl w-full mx-auto">
            <div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-1/3"/><div className="h-32 bg-gray-200 rounded"/><div className="h-64 bg-gray-200 rounded"/></div>
          </main>
        </div>
      </div>
    )
  }
  if (roadmap === null) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0"><Header />
          <main className="p-8 max-w-7xl w-full mx-auto">
            <div className="text-center py-16 bg-white rounded-2xl border">
              <div className="w-16 h-16 rounded-2xl bg-[#6C5BFF]/10 flex items-center justify-center mx-auto mb-4 text-2xl">🗺️</div>
              <h2 className="text-xl font-bold">No roadmap yet</h2>
              <p className="text-sm text-zinc-500 mt-2 max-w-md mx-auto">Create your first personalized roadmap — tell us your goal, level, and time, and HiPath AI will build a structured, adaptive plan via Nvidia NIMs.</p>
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

  const handleDelete = () => {
    if (confirm("Delete roadmap? This will clear progress. This cannot be undone.")) {
      clearRoadmap()
      localStorage.removeItem("hipath_progress")
      localStorage.removeItem("hipath_onboarding_draft")
      setRoadmap(null)
      router.push("/onboarding")
    }
  }
  const handleEdit = () => {
    router.push(`/onboarding?edit=${roadmap.id}`)
  }

  // Flexible lock: supports DAG prerequisites if lesson has prerequisites field, else linear
  const isLessonLocked = (phase: Phase, pi: number, lesson: Lesson, idx: number) => {
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
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <div className="text-sm text-zinc-500 mb-2">Dashboard &gt; Roadmap</div>
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
            <div>
              <h1 className="text-2xl font-bold">{roadmap.title}</h1>
              <p className="text-sm text-zinc-500 mt-1">{roadmap.description}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="flex border rounded-lg overflow-hidden">
                <button onClick={()=> setViewMode("grid")} className={`px-3 py-1.5 text-xs flex items-center gap-1 ${viewMode==="grid" ? "bg-[#6C5BFF] text-white" : "bg-white"}`}><LayoutGrid className="w-3 h-3"/> Grid</button>
                <button onClick={()=> setViewMode("list")} className={`px-3 py-1.5 text-xs flex items-center gap-1 ${viewMode==="list" ? "bg-[#6C5BFF] text-white" : "bg-white"}`}><List className="w-3 h-3"/> List</button>
              </div>
              <Button variant="outline" size="sm" onClick={handleEdit}>Edit</Button>
              <Button variant="outline" size="sm" onClick={()=> alert("Pause coming soon — your streak will freeze.")}>Pause</Button>
              <Button variant="outline" size="sm" className="text-red-600 border-red-200" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6">
            <Card className="p-4 text-center"><div className="text-[#6C5BFF] font-bold text-lg">{pct}%</div><div className="text-xs text-zinc-500">Complete</div></Card>
            <Card className="p-4 text-center"><div className="font-bold text-lg">{total - done}</div><div className="text-xs text-zinc-500">Lessons remaining</div></Card>
            <Card className="p-4 text-center"><div className="font-bold text-lg">{gam.streak} days</div><div className="text-xs text-zinc-500">Current streak</div></Card>
          </div>

          <div className="mt-6 space-y-4">
            {roadmap.phases.map((phase, pi)=>{
              const isOpen = openPhases[phase.id] ?? (pi===0)
              const phaseDone = phase.lessons.filter((l)=> progress[l.id]?.passed).length
              return (
                <Card key={phase.id} className="overflow-hidden">
                  <button onClick={()=> setOpenPhases(prev=> ({...prev, [phase.id]: !isOpen}))} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left">
                    <div>
                      <h3 className="font-semibold">{phase.title}</h3>
                      <p className="text-xs text-zinc-500">{phaseDone} / {phase.lessons.length} completed • Flexible — expands as you progress</p>
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
                              <Link href={locked ? "#" : `/roadmap/${roadmap.id}/lesson/${lesson.id}`} className={`rounded-xl border p-4 flex ${viewMode==="grid" ? "flex-col items-center text-center gap-2" : "flex-row items-center gap-4"} transition ${locked?"bg-gray-100 opacity-60 cursor-not-allowed": completed?"bg-emerald-50 border-emerald-200":"bg-white hover:border-[var(--primary)] hover:shadow-md"}`}>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${completed?"bg-emerald-500 text-white": locked?"bg-gray-300 text-white":"bg-[var(--primary)] text-white"}`}>{completed? <Check className="w-5 h-5"/> : locked? <Lock className="w-4 h-4"/> : lesson.idx}</div>
                                <div className={viewMode==="grid" ? "text-center" : "flex-1 text-left"}>
                                  <div className="text-xs font-medium leading-tight line-clamp-2">{lesson.title}</div>
                                  <div className="text-[11px] text-zinc-500">{locked? "Locked — pass previous" : completed? "Completed" : "Start →"}</div>
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              )
            })}
          </div>
          <p className="text-xs text-zinc-400 mt-6 text-center">Flexible roadmap — phases/lessons from Nvidia NIMs JSON. Add phases via API without code change. DAG prerequisites supported.</p>
        </main>
      </div>
    </div>
  )
}
