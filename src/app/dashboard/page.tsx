"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Card, CardContent } from "@/components/ui/card"
import { Clock, ClipboardList, Star, Flame, Send } from "lucide-react"
import { useEffect, useState } from "react"
import { loadRoadmap, loadGam, loadProgress } from "@/lib/store"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

export default function Dashboard() {
  const [roadmap, setRoadmap] = useState<any>(undefined)
  const [gam, setGam] = useState({ xp:0, level:1, streak:0, lessonsDone:0, studyMinutes:0, passRate:0, bestStreak:0 })
  const [progress, setProgress] = useState<Record<string,any>>({})
  const [mounted, setMounted] = useState(false)
  useEffect(()=> { setMounted(true); setRoadmap(loadRoadmap()); setGam(loadGam() as any); setProgress(loadProgress()) }, [])

  const lessonsDone = Object.values(progress).filter((p:any)=>p.completed).length
  const isFresh = !roadmap && lessonsDone===0 && gam.xp===0
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-zinc-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-bold">Dashboard</h1>
            <Link href="/onboarding" className="text-xs text-[#6C5BFF] underline">Create new roadmap</Link>
          </div>
          <motion.div initial={{opacity:0, y:12}} animate={{opacity:1, y:0}} transition={{duration:0.4}} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Clock, label:"STUDY TIME", value:`${gam.studyMinutes}m`, sub:"+0m vs last week", color:"text-zinc-400 bg-gray-100 dark:bg-zinc-800" },
              { icon: ClipboardList, label:"LESSONS", value: lessonsDone, sub: isFresh ? "Start your journey" : "Keep up momentum!", color:"text-emerald-500 bg-emerald-50" },
              { icon: Star, label:"LEVEL", value:`Lv.${gam.level}`, sub:`${gam.xp} XP`, color:"text-amber-500 bg-amber-50" },
              { icon: Flame, label:"STREAK", value:`${gam.streak}d`, sub: gam.streak? "On a roll" : "Begin streak", color:"text-orange-500 bg-orange-50" },
            ].map((k,i)=>(
              <motion.div key={k.label} initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} transition={{delay:i*0.07}}>
                <Card className="p-4 hover:shadow-md transition-shadow"><div className="flex items-center gap-3"><k.icon className={`w-8 h-8 p-2 rounded-lg ${k.color}`} /><div><div className="text-xs text-zinc-500">{k.label}</div><div className="font-bold">{k.value as any}</div><div className="text-[11px] text-zinc-500">{k.sub}</div></div></div></Card>
              </motion.div>
            ))}
          </motion.div>

          <div className="grid lg:grid-cols-[1fr_380px] gap-6 mt-6">
            <div>
              <h3 className="font-semibold mb-3">This Week</h3>
              <Card className="p-6">
                <div className="grid grid-cols-7 gap-2 text-center">
                  {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d,i)=> (
                    <div key={d} className="space-y-2">
                      <div className="text-xs text-zinc-500">{d}</div>
                      <div className={`h-10 rounded-lg flex items-center justify-center text-xs ${i<5?"bg-[#6C5BFF] text-white":"bg-gray-100 dark:bg-zinc-800"}`}>{i<5?"✓":"—"}</div>
                    </div>
                  ))}
                </div>
                {!mounted ? <div className="mt-6 h-4 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse w-1/2"/> : !roadmap ? <div className="mt-6 text-sm text-zinc-500">No roadmap yet. <Link href="/onboarding" className="text-[#6C5BFF]">Generate one →</Link></div> :
                  <div className="mt-6"><div className="text-sm font-medium">{roadmap.title}</div><div className="text-xs text-zinc-500 mt-1">{roadmap.description}</div><Link href="/roadmap"><Button size="sm" className="mt-3">Continue Learning</Button></Link></div>}
              </Card>
            </div>
            <Card className="p-0 overflow-hidden border-[#6C5BFF] border-2">
              <div className="bg-[#6C5BFF] text-white p-4 flex justify-between items-center">
                <div><div className="font-semibold text-sm">AI Mentor</div><div className="text-xs opacity-90">Ask me anything about your learning journey</div></div>
                <Link href="/tutor" className="text-xs underline">Full chat</Link>
              </div>
              <div className="p-4 text-sm bg-violet-50 dark:bg-zinc-900">
                {isFresh ? "Welcome to HiPath AI! Create your first roadmap to get a personalized day-by-day plan with your AI mentor." : `You're doing great, maintaining a ${gam.streak}-day learning streak! Keep building your foundation — focus on your weak areas and stay consistent!`}
              </div>
              <div className="p-3 flex gap-2 border-t dark:border-zinc-800">
                <input placeholder="Ask your mentor..." className="flex-1 h-9 rounded-lg border px-3 text-sm dark:bg-zinc-800 dark:border-zinc-700" />
                <Link href="/tutor"><Button size="sm">Send</Button></Link>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
