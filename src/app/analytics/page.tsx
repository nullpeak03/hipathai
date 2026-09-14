"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/card"
import { useEffect, useState } from "react"
import { loadGam, loadProgress } from "@/lib/store"
import { progressToNextLevel } from "@/lib/gamification"

export default function AnalyticsPage() {
  const [gam, setGam] = useState({ xp:250, level:3, streak:8, passRate:67 })
  const [prog, setProg] = useState<any>({})
  useEffect(()=> { setGam(loadGam() as any); setProg(loadProgress()) }, [])
  const p = progressToNextLevel(gam.xp)
  const passRate = gam.passRate ?? 67
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-zinc-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <div className="text-sm text-zinc-500 mb-1">Dashboard &gt; Analytics</div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-zinc-500">Track your learning patterns and progress</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <Card className="p-6 text-center"><div className="text-xs text-zinc-500">LEVEL</div><div className="text-xl font-bold text-[#6C5BFF]">Lv.{p.level}</div></Card>
            <Card className="p-6 text-center"><div className="text-xs text-zinc-500">XP</div><div className="text-xl font-bold">{gam.xp}</div></Card>
            <Card className="p-6 text-center"><div className="text-xs text-zinc-500">PASS RATE</div><div className="text-xl font-bold text-amber-600">{passRate}%</div></Card>
            <Card className="p-6 text-center"><div className="text-xs text-zinc-500">STREAK</div><div className="text-xl font-bold text-orange-600">{gam.streak}d</div></Card>
          </div>
          <Card className="p-6 mt-6">
            <div className="flex justify-between items-center"><span className="font-semibold text-sm">Level {p.level} Progress</span><span className="text-xs text-zinc-500">{gam.xp} / {p.nextThreshold} XP</span></div>
            <div className="mt-3 h-3 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden"><div className="h-3 bg-gradient-to-r from-violet-600 to-amber-500 rounded-full transition-all" style={{width: `${p.progress}%`}} /></div>
            <div className="text-xs text-zinc-500 mt-2">{p.progress.toFixed(0)}% to Level {p.level+1}</div>
          </Card>
        </main>
      </div>
    </div>
  )
}
