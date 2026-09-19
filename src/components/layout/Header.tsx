"use client"
import { Search, Bell, Settings, Flame, Trophy, Star } from "lucide-react"
import { useEffect, useState } from "react"
import { loadGam } from "@/lib/store"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
export function Header() {
  const { user } = useUser()
  const [gam, setGam] = useState({ xp: 0, level: 1, streak: 0 })
  const [search, setSearch] = useState("")
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
    try { alert("Notifications — daily reminders and streak alerts coming soon.") } catch {}
  }
  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-4 sticky top-0 z-20">
      <div className="flex items-center gap-4 flex-1">
        <Link href="/dashboard" className="flex items-center gap-2 md:hidden">
          <div className="w-8 h-8 rounded-lg bg-[#6C5BFF] flex items-center justify-center text-white font-bold text-sm">H</div>
          <span className="font-semibold text-sm">HiPath AI</span>
        </Link>
        <div className="hidden md:flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input id="global-search" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=> e.key==="Enter" && handleSearch()} placeholder="Search anything..." className="w-full pl-9 pr-12 h-9 rounded-full border bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#6C5BFF]/20" />
            <button onClick={handleSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-white border px-1.5 py-0.5 rounded hover:bg-gray-50">⌘K</button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <Link href="/analytics" className="hidden sm:flex items-center gap-1.5 text-xs font-medium hover:text-zinc-900"><Trophy className="w-4 h-4 text-amber-500" /> Lv.{gam.level}</Link>
        <Link href="/analytics" className="hidden sm:flex items-center gap-1 text-xs font-medium hover:text-zinc-900"><Star className="w-4 h-4 text-yellow-500" /> {gam.xp} XP</Link>
        <Link href="/analytics" className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700"><Flame className="w-4 h-4" /> {gam.streak}d</Link>
        <button onClick={handleBell} className="p-2 rounded-full hover:bg-gray-100" title="Notifications"><Bell className="w-4 h-4" /></button>
        <Link href="/settings" className="p-2 rounded-full hover:bg-gray-100"><Settings className="w-4 h-4" /></Link>
        {user?.imageUrl ? <Image src={user.imageUrl} alt="avatar" width={32} height={32} className="w-8 h-8 rounded-full border" /> : <div className="w-8 h-8 rounded-full bg-[#6C5BFF] text-white flex items-center justify-center text-xs font-bold">{user?.firstName?.[0] || "U"}</div>}
      </div>
    </header>
  )
}
