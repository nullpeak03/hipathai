"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/card"
import { Clock, ClipboardList, Star, Flame, type LucideIcon } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { loadRoadmap, loadGam, loadProgress, loadRoadmapAsync, loadGamAsync, loadProgressAsync, loadWeakTopics, loadDailyActivity, loadDueReviews, type RoadmapData, type Gamification, type Progress, type WeakTopic, type ReviewItem } from "@/lib/store"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { staggerParent, staggerChild } from "@/lib/motion"
import { AnimatedNumber } from "@/components/effects/animated-number"
import { useUser } from "@clerk/nextjs"

const toDayKey = (d: Date) => d.toISOString().slice(0, 10)
function mondayOfWeek(ref: Date): Date {
  const d = new Date(ref)
  const dow = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - dow)
  return d
}

export default function Dashboard() {
  const router = useRouter()
  const { user } = useUser()
  const [roadmap, setRoadmap] = useState<RoadmapData | null | undefined>(undefined)
  const [gam, setGam] = useState<Gamification>({ xp:0, level:1, streak:0, lessonsDone:0, studyMinutes:0, passRate:0, bestStreak:0, lastStudyDate: "" })
  const [progress, setProgress] = useState<Progress>({})
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([])
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set())
  const [weekDelta, setWeekDelta] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [mentorInput, setMentorInput] = useState("")
  useEffect(()=> {
    setMounted(true)
    // immediate local for fast paint
    setRoadmap(loadRoadmap())
    setGam(loadGam())
    setProgress(loadProgress())
    // async Supabase hydrate (helpers degrade to cache when offline/signed out)
    ;(async () => {
      try {
        const [rm, gm, prog, weak, act, due] = await Promise.all([
          loadRoadmapAsync(),
          loadGamAsync(),
          loadProgressAsync(),
          loadWeakTopics(),
          loadDailyActivity(14),
          loadDueReviews()
        ])
        if (rm) setRoadmap(rm)
        setGam(gm)
        if (prog && Object.keys(prog).length) setProgress(prog)
        setWeakTopics(weak)
        setReviews(due)
        // Real week grid + week-over-week minutes from tracked activity
        setActiveDates(new Set(act.filter((a)=>a.minutes>0||a.lessons>0).map((a)=>a.date)))
        const byDate = new Map(act.map((a)=>[a.date, a.minutes]))
        const mon = mondayOfWeek(new Date())
        let thisW = 0, lastW = 0
        for (let i=0;i<7;i++) {
          const d1 = new Date(mon); d1.setDate(mon.getDate()+i)
          const d0 = new Date(mon); d0.setDate(mon.getDate()-7+i)
          thisW += byDate.get(toDayKey(d1)) ?? 0
          lastW += byDate.get(toDayKey(d0)) ?? 0
        }
        setWeekDelta(thisW - lastW)
      } catch {}
    })()
  }, [user?.id])
  const handleMentorSend = () => {
    const q = mentorInput.trim()
    if (!q) { router.push("/tutor"); return }
    // Persist to localStorage for tutor to pick up, and via query param
    try { localStorage.setItem("hipath_tutor_prefill", q) } catch {}
    router.push(`/tutor?q=${encodeURIComponent(q)}`)
  }

  const lessonsDone = Object.values(progress).filter((p)=>p.completed).length
  const isFresh = !roadmap && lessonsDone===0 && gam.xp===0
  return (
          <div className="flex min-h-screen bg-app">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-bold">Dashboard</h1>
            <Link href="/onboarding?new=1" className="text-xs text-primary underline">Create new roadmap</Link>
          </div>
          <motion.div variants={staggerParent} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {([
              { icon: Clock, label:"STUDY TIME", value:<AnimatedNumber value={gam.studyMinutes} format={(m)=>`${m}m`} />, sub:`${weekDelta>=0?"+":""}${weekDelta}m vs last week`, color:"text-zinc-400 bg-muted" },
              { icon: ClipboardList, label:"LESSONS", value:<AnimatedNumber value={lessonsDone} />, sub: isFresh ? "Start your journey" : "Keep up momentum!", color:"text-emerald-500 bg-ok-bg" },
              { icon: Star, label:"LEVEL", value:<>Lv.<AnimatedNumber value={gam.level} /></>, sub:<><AnimatedNumber value={gam.xp} /> XP</>, color:"text-amber-500 bg-warn-bg" },
              { icon: Flame, label:"STREAK", value:<AnimatedNumber value={gam.streak} format={(d)=>`${d}d`} />, sub: gam.streak? "On a roll" : "Begin streak", color:"text-orange-500 bg-warn-bg" },
            ] as { icon: LucideIcon; label: string; value: ReactNode; sub: ReactNode; color: string }[]).map((k)=>(
              <motion.div key={k.label} variants={staggerChild} whileHover={{ y: -2 }}>
                <Card className="p-4 hover:shadow-md transition-shadow"><div className="flex items-center gap-3"><k.icon className={`w-8 h-8 p-2 rounded-lg ${k.color}`} /><div><div className="text-xs text-muted-foreground">{k.label}</div><div className="font-bold">{k.value}</div><div className="text-[11px] text-muted-foreground">{k.sub}</div></div></div></Card>
              </motion.div>
            ))}
          </motion.div>

          <div className="grid lg:grid-cols-[1fr_380px] gap-6 mt-6">
            <div>
              <h3 className="font-semibold mb-3">This Week</h3>
              <Card className="p-6">
                <div className="grid grid-cols-7 gap-2 text-center">
                  {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d,i)=> {
                    const dt = mondayOfWeek(new Date())
                    dt.setDate(dt.getDate()+i)
                    const active = activeDates.has(toDayKey(dt))
                    return (
                      <div key={d} className="space-y-2">
                        <div className="text-xs text-muted-foreground">{d}</div>
                        <div className={`h-10 rounded-lg flex items-center justify-center text-xs ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{active ? "✓" : "—"}</div>
                      </div>
                    )
                  })}
                </div>
                {!mounted ? <div className="mt-6 h-4 bg-muted rounded animate-pulse w-1/2"/> : !roadmap ? <div className="mt-6 text-sm text-muted-foreground">No roadmap yet. <Link href="/onboarding" className="text-primary">Generate one →</Link></div> :
                  <div className="mt-6"><div className="text-sm font-medium">{roadmap.title}</div><div className="text-xs text-muted-foreground mt-1">{roadmap.description}</div><Link href="/roadmap"><Button size="sm" className="mt-3">Continue Learning</Button></Link></div>}
              </Card>
            </div>
            <Card className="p-0 overflow-hidden border-primary border-2">
              <div className="bg-primary text-primary-foreground p-4 flex justify-between items-center">
                <div><div className="font-semibold text-sm">AI Mentor</div><div className="text-xs opacity-90">Ask me anything about your learning journey</div></div>
                <Link href="/tutor" className="text-xs underline">Full chat</Link>
              </div>
              <div className="p-4 text-sm bg-ai-bg">
                {isFresh ? "Welcome to HiPath AI! Create your first roadmap to get a personalized day-by-day plan with your AI mentor." : `You're doing great, maintaining a ${gam.streak}-day learning streak! Keep building your foundation — focus on your weak areas and stay consistent!`}
              </div>
              <div className="p-3 flex gap-2 border-t border-border">
                <input value={mentorInput} onChange={e=>setMentorInput(e.target.value)} onKeyDown={e=> e.key==="Enter" && handleMentorSend()} placeholder="Ask your mentor..." className="flex-1 h-9 rounded-lg border px-3 text-sm focus:outline-none" />
                <Button size="sm" onClick={handleMentorSend}>Send</Button>
              </div>
            </Card>
          </div>

          {weakTopics.length > 0 && (
            <Card className="p-6 mt-6">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm">Weak areas — practice these next</h3>
                <Link href="/tutor" className="text-xs text-primary underline">Open tutor</Link>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {weakTopics.map((w) => (
                  <Link
                    key={w.topic}
                    href={`/tutor?q=${encodeURIComponent(`Help me practice: ${w.topic}`)}`}
                    className="text-xs border border-danger-border bg-danger-bg text-danger-fg px-3 py-1.5 rounded-full hover:opacity-80"
                  >
                    {w.topic} · {w.fail_count}×
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {reviews.length > 0 && (
            <Card className="p-6 mt-6">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm">Due for review — spaced repetition</h3>
                <span className="text-xs text-muted-foreground">{reviews.length} due</span>
              </div>
              <div className="mt-3 space-y-2">
                {reviews.slice(0, 5).map((r) => (
                  <Link
                    key={r.lessonId}
                    href={`/roadmap/${r.roadmapId}/lesson/${r.lessonId}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 hover:border-primary hover:shadow-sm transition"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{r.title}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{r.topic}</div>
                    </div>
                    <span className="text-[11px] font-medium text-warn-fg bg-warn-bg border border-warn-border rounded-full px-2.5 py-1 shrink-0">
                      {r.overdueDays > 0 ? `${r.overdueDays}d overdue` : "due today"}
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}
