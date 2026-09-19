"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/card"
import { useEffect, useState } from "react"
import { loadGam, loadGamAsync, loadDailyActivity, loadBenchmarks, type ActivityDay, type Benchmarks } from "@/lib/store"
import { progressToNextLevel } from "@/lib/gamification"

function heatColor(minutes: number): string {
  if (minutes >= 30) return "bg-[#6C5BFF] text-white"
  if (minutes >= 15) return "bg-violet-400 text-white"
  if (minutes >= 1) return "bg-violet-200"
  return "bg-gray-100"
}

export default function AnalyticsPage() {
  const [gam, setGam] = useState({ xp:0, level:1, streak:0, passRate:0, bestStreak:0 })
  const [days, setDays] = useState<ActivityDay[]>([])
  const [bench, setBench] = useState<Benchmarks | null>(null)
  useEffect(()=> {
    setGam(loadGam())
    // Reconcile gamification + load real per-day activity for the heatmap
    void loadGamAsync().then(setGam).catch(()=>{})
    void loadDailyActivity(14).then(setDays).catch(()=>{})
    void loadBenchmarks().then(setBench).catch(()=>{})
  }, [])
  const p = progressToNextLevel(gam.xp)
  const passRate = gam.passRate ?? 0

  const byDate = new Map(days.map((d) => [d.date, d]))
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date()
    dt.setDate(dt.getDate() - (6 - i))
    const key = dt.toISOString().slice(0, 10)
    const row = byDate.get(key)
    return {
      key,
      label: dt.toLocaleDateString("en-US", { weekday: "narrow" }),
      dayNum: dt.getDate(),
      minutes: row?.minutes ?? 0,
      lessons: row?.lessons ?? 0,
    }
  })
  const weekMin = last7.reduce((a, d) => a + d.minutes, 0)
  const weekLessons = last7.reduce((a, d) => a + d.lessons, 0)
  const activeDays = last7.filter((d) => d.minutes > 0 || d.lessons > 0).length

  const benchRows = bench ? [
    { label: "XP", mine: gam.xp, avg: bench.avgXp },
    { label: "Level", mine: p.level, avg: bench.avgLevel },
    { label: "Streak (days)", mine: gam.streak, avg: bench.avgStreak },
    { label: "Pass rate (%)", mine: passRate, avg: bench.avgPassRate },
    { label: "Minutes this week", mine: weekMin, avg: bench.avgWeeklyMinutes },
  ] : []

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
          <Card className="p-6 mt-6">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-sm">Study heatmap — last 7 days</span>
              <span className="text-xs text-zinc-500">{weekMin}m · {weekLessons} lessons · {activeDays}/7 active</span>
            </div>
            <div className="grid grid-cols-7 gap-2 mt-4 text-center">
              {last7.map((d) => (
                <div key={d.key}>
                  <div className="text-xs text-zinc-500">{d.label}</div>
                  <div title={`${d.minutes}m · ${d.lessons} lessons`} className={`h-14 rounded-lg flex flex-col items-center justify-center text-xs mt-1 ${heatColor(d.minutes)}`}>
                    <span className="font-semibold">{d.minutes > 0 ? `${d.minutes}m` : "—"}</span>
                    <span className="text-[10px] opacity-80">{d.dayNum}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-zinc-500 mt-3">Tracked from real lesson time. Darker means more minutes.</div>
          </Card>
          {bench && benchRows.length > 0 && (
            <Card className="p-6 mt-6">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm">Community benchmarks</span>
                <span className="text-xs text-zinc-500">{bench.learners} learners</span>
              </div>
              <div className="mt-4 space-y-3">
                {benchRows.map((r) => {
                  const max = Math.max(r.mine, r.avg, 1)
                  return (
                    <div key={r.label}>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">{r.label}</span>
                        <span><b>You {r.mine}</b> <span className="text-zinc-400">· Avg {r.avg}</span></span>
                      </div>
                      <div className="mt-1 space-y-1">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-1.5 bg-[#6C5BFF] rounded-full" style={{ width: `${(r.mine / max) * 100}%` }} /></div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-1.5 bg-zinc-300 rounded-full" style={{ width: `${(r.avg / max) * 100}%` }} /></div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="text-xs text-zinc-500 mt-3">Aggregate-only averages across learners — no personal data shared.</div>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}
