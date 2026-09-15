"use client"
import { Search, Bell, Settings, Flame, Trophy, Star } from "lucide-react"
import { useEffect, useState } from "react"
import { loadGam } from "@/lib/store"
import Link from "next/link"
export function Header() {
  let user: any = null
  try {
    // useUser may throw if ClerkProvider not mounted or key mismatch (preview vs live)
    const { useUser } = require("@clerk/nextjs") as any
    const result = useUser()
    user = result?.user || null
  } catch {}
  const [gam, setGam] = useState({ xp: 0, level: 1, streak: 0 })
  useEffect(()=> {
    try { setGam(loadGam()) } catch {}
  }, [])
  return (
    <header className="h-14 border-b bg-white dark:bg-zinc-900 dark:border-zinc-800 flex items-center justify-between px-4 sticky top-0 z-20">
      <div className="flex items-center gap-4 flex-1">
        <Link href="/dashboard" className="flex items-center gap-2 md:hidden">
          <div className="w-8 h-8 rounded-lg bg-[#6C5BFF] flex items-center justify-center text-white font-bold text-sm">H</div>
          <span className="font-semibold text-sm">HiPath AI</span>
        </Link>
        <div className="hidden md:flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input placeholder="Search anything..." className="w-full pl-9 pr-12 h-9 rounded-full border bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700 text-sm focus:outline-none" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-white dark:bg-zinc-700 border px-1.5 py-0.5 rounded">⌘K</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium"><Trophy className="w-4 h-4 text-amber-500" /> Lv.{gam.level}</span>
        <span className="hidden sm:flex items-center gap-1 text-xs font-medium"><Star className="w-4 h-4 text-yellow-500" /> {gam.xp} XP</span>
        <span className="flex items-center gap-1 text-xs font-medium text-orange-600"><Flame className="w-4 h-4" /> {gam.streak}d</span>
        <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"><Bell className="w-4 h-4" /></button>
        <Link href="/settings" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"><Settings className="w-4 h-4" /></Link>
        {user?.imageUrl ? <img src={user.imageUrl} alt="avatar" className="w-8 h-8 rounded-full border" /> : <div className="w-8 h-8 rounded-full bg-[#6C5BFF] text-white flex items-center justify-center text-xs font-bold">{user?.firstName?.[0] || "U"}</div>}
      </div>
    </header>
  )
}
