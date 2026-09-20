"use client"
import { Search, Bell, Settings, Flame, Trophy, Star } from "lucide-react"
import { useEffect, useState } from "react"
import { loadGam, loadDueReviews, loadWeakTopics, type ReviewItem, type WeakTopic } from "@/lib/store"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
export function Header() {
  const { user } = useUser()
  const [gam, setGam] = useState({ xp: 0, level: 1, streak: 0 })
  const [search, setSearch] = useState("")
  const [bellOpen, setBellOpen] = useState(false)
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [weak, setWeak] = useState<WeakTopic[]>([])
  const router = useRouter()
  useEffect(()=> {
    try { setGam(loadGam()) } catch {}
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        document.getElementById("global-search")?.focus()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])
  const handleSearch = () => {
    const q = search.trim()
    if (!q) return
    router.push(`/tutor?q=${encodeURIComponent(q)}`)
  }
  const handleBell = () => {
    const next = !bellOpen
    setBellOpen(next)
    if (next) {
      // Refresh notification counts when opened (graceful offline)
      void loadDueReviews().then(setReviews).catch(()=>{})
      void loadWeakTopics().then(setWeak).catch(()=>{})
    }
  }
  const notifCount = reviews.length + weak.length
  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 sticky top-0 z-20">
      <div className="flex items-center gap-4 flex-1">
        <Link href="/dashboard" className="flex items-center gap-2 md:hidden">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">H</div>
          <span className="font-semibold text-sm">HiPath AI</span>
        </Link>
        <div className="hidden md:flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input id="global-search" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=> e.key==="Enter" && handleSearch()} placeholder="Search anything..." className="w-full pl-9 pr-12 h-9 rounded-full border border-border bg-muted text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            <button onClick={handleSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-card border border-border px-1.5 py-0.5 rounded hover:bg-muted">⌘K</button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <Link href="/analytics" className="hidden sm:flex items-center gap-1.5 text-xs font-medium hover:text-foreground"><Trophy className="w-4 h-4 text-amber-500" /> Lv.{gam.level}</Link>
        <Link href="/analytics" className="hidden sm:flex items-center gap-1 text-xs font-medium hover:text-foreground"><Star className="w-4 h-4 text-yellow-500" /> {gam.xp} XP</Link>
        <Link href="/analytics" className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700"><Flame className="w-4 h-4" /> {gam.streak}d</Link>
        <div className="relative">
          <button onClick={handleBell} className="p-2 rounded-full hover:bg-muted relative" title="Notifications" aria-label="Notifications">
            <Bell className="w-4 h-4" />
            {notifCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center">
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            )}
          </button>
          {bellOpen && (
            <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl border border-border bg-card shadow-xl overflow-hidden z-30">
              <div className="flex justify-between items-center px-4 py-3 border-b border-border">
                <span className="font-semibold text-sm">Notifications</span>
                <button onClick={()=> setBellOpen(false)} className="text-xs text-muted-foreground hover:text-foreground" aria-label="Close notifications">✕</button>
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                {reviews.length === 0 && weak.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">All caught up. Reviews and weak areas will appear here.</p>
                )}
                {reviews.slice(0, 4).map((r) => (
                  <Link key={r.lessonId} href={`/roadmap/${r.roadmapId}/lesson/${r.lessonId}`} onClick={()=> setBellOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-muted">
                    <div className="text-xs font-medium">📚 Review due: {r.title}</div>
                    <div className="text-[11px] text-muted-foreground">{r.overdueDays > 0 ? `${r.overdueDays}d overdue` : "due today"}</div>
                  </Link>
                ))}
                {weak.slice(0, 4).map((w) => (
                  <Link key={w.topic} href={`/tutor?q=${encodeURIComponent(`Help me practice: ${w.topic}`)}`} onClick={()=> setBellOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-muted">
                    <div className="text-xs font-medium">🎯 Weak area: {w.topic}</div>
                    <div className="text-[11px] text-muted-foreground">failed {w.fail_count}× — practice with the tutor</div>
                  </Link>
                ))}
              </div>
              <Link href="/dashboard" onClick={()=> setBellOpen(false)} className="block text-center text-xs text-primary py-2 border-t border-border hover:bg-muted">View dashboard →</Link>
            </div>
          )}
        </div>
        <Link href="/settings" className="p-2 rounded-full hover:bg-muted" aria-label="Settings"><Settings className="w-4 h-4" /></Link>
        {user?.imageUrl ? <Image src={user.imageUrl} alt="avatar" width={32} height={32} className="w-8 h-8 rounded-full border border-border" /> : <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">{user?.firstName?.[0] || "U"}</div>}
      </div>
    </header>
  )
}
