"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Card, CardContent } from "@/components/ui/card"
import { Clock, ClipboardList, Star, Flame, Send } from "lucide-react"
import { useEffect, useState } from "react"
import { loadRoadmap, loadGam, loadProgress } from "@/lib/store"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Dashboard() {
  const [roadmap, setRoadmap] = useState<any>(null)
  const [gam, setGam] = useState({ xp:250, level:3, streak:8, lessonsDone:5, studyMinutes:45 })
  const [progress, setProgress] = useState<Record<string,any>>({})
  useEffect(()=> { setRoadmap(loadRoadmap()); setGam(loadGam() as any); setProgress(loadProgress()) }, [])

  const lessonsDone = Object.values(progress).filter((p:any)=>p.completed).length || gam.lessonsDone
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4"><div className="flex items-center gap-3"><Clock className="w-8 h-8 text-zinc-400 bg-gray-100 dark:bg-zinc-800 p-2 rounded-lg" /><div><div className="text-xs text-zinc-500">STUDY TIME</div><div className="font-bold">{gam.studyMinutes}m</div><div className="text-[11px] text-emerald-600">+45m vs last week</div></div></div></Card>
            <Card className="p-4"><div className="flex items-center gap-3"><ClipboardList className="w-8 h-8 text-emerald-500 bg-emerald-50 p-2 rounded-lg" /><div><div className="text-xs text-zinc-500">LESSONS</div><div className="font-bold">{lessonsDone}</div><div className="text-[11px] text-zinc-500">Keep up momentum!</div></div></div></Card>
            <Card className="p-4"><div className="flex items-center gap-3"><Star className="w-8 h-8 text-amber-500 bg-amber-50 p-2 rounded-lg" /><div><div className="text-xs text-zinc-500">LEVEL</div><div className="font-bold">Lv.{gam.level}</div><div className="text-[11px] text-zinc-500">{gam.xp} XP</div></div></div></Card>
            <Card className="p-4"><div className="flex items-center gap-3"><Flame className="w-8 h-8 text-orange-500 bg-orange-50 p-2 rounded-lg" /><div><div className="text-xs text-zinc-500">STREAK</div><div className="font-bold">{gam.streak}d</div><div className="text-[11px] text-zinc-500">On a roll</div></div></div></Card>
          </div>

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
                {!roadmap ? <div className="mt-6 text-sm text-zinc-500">No roadmap yet. <Link href="/onboarding" className="text-[#6C5BFF]">Generate one →</Link></div> :
                  <div className="mt-6"><div className="text-sm font-medium">{roadmap.title}</div><div className="text-xs text-zinc-500 mt-1">{roadmap.description}</div><Link href="/roadmap/1"><Button size="sm" className="mt-3">Continue Learning</Button></Link></div>}
              </Card>
            </div>
            <Card className="p-0 overflow-hidden border-[#6C5BFF] border-2">
              <div className="bg-[#6C5BFF] text-white p-4 flex justify-between items-center">
                <div><div className="font-semibold text-sm">AI Mentor</div><div className="text-xs opacity-90">Ask me anything about your learning journey</div></div>
                <Link href="/tutor" className="text-xs underline">Full chat</Link>
              </div>
              <div className="p-4 text-sm bg-violet-50 dark:bg-zinc-900">
                You're doing great, maintaining an {gam.streak}-day learning streak! As a beginner, you're actively building your foundation in Python, focusing on strengthening areas like data types, parameters, and VS Code proficiency. Keep up the consistent effort!
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
