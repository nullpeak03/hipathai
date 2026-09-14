"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/card"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { loadGam } from "@/lib/store"

const tabs = ["Profile","Account","Notifications","Privacy","Appearance","Billing"] as const

export default function SettingsPage() {
  const [active, setActive] = useState<typeof tabs[number]>("Profile")
  const { theme, setTheme } = useTheme()
  const [gam, setGam] = useState({level:3, xp:250, streak:8})
  const [mounted, setMounted] = useState(false)
  useEffect(()=> { setMounted(true); setGam(loadGam() as any) }, [])
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-zinc-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-zinc-500">Manage your account and preferences</p>
          <div className="flex gap-6 border-b dark:border-zinc-800 mt-6 overflow-x-auto">
            {tabs.map(t=> (
              <button key={t} onClick={()=> t==="Billing" ? alert("Billing hidden for V1 — free") : setActive(t)} className={`pb-3 text-sm whitespace-nowrap border-b-2 ${active===t?"border-[#6C5BFF] text-[#6C5BFF] font-medium":"border-transparent text-zinc-500"}`}>{t} {t==="Billing" && <span className="text-[10px]"> (V1 hidden)</span>}</button>
            ))}
          </div>
          <div className="mt-6">
            {active==="Profile" && <Card className="p-6"><h3 className="font-semibold">Overview</h3><div className="grid grid-cols-4 gap-4 mt-4"><div className="text-center p-4 bg-gray-50 dark:bg-zinc-800 rounded-xl"><div className="font-bold text-[#6C5BFF]">Lv.{gam.level}</div><div className="text-xs text-zinc-500">Level</div></div><div className="text-center p-4 bg-gray-50 dark:bg-zinc-800 rounded-xl"><div className="font-bold text-amber-600">{gam.xp}</div><div className="text-xs">XP Points</div></div><div className="text-center p-4 bg-gray-50 dark:bg-zinc-800 rounded-xl"><div className="font-bold">{gam.streak}d</div><div className="text-xs">Current Streak</div></div><div className="text-center p-4 bg-gray-50 dark:bg-zinc-800 rounded-xl"><div className="font-bold">0d</div><div className="text-xs">Best Streak</div></div></div></Card>}
            {active==="Appearance" && <Card className="p-6"><h3 className="font-semibold">Appearance</h3><p className="text-sm text-zinc-500 mt-1">Light / Dark as per V1 spec (screenshots rebuilt)</p><div className="flex gap-3 mt-4">{["light","dark"].map(th=> <button key={th} onClick={()=>setTheme(th)} className={`px-6 py-3 rounded-xl border text-sm capitalize ${mounted && theme===th?"bg-[#6C5BFF] text-white":"bg-white dark:bg-zinc-900"}`}>{th}</button>)}</div></Card>}
            {active!=="Profile" && active!=="Appearance" && <Card className="p-6 text-sm text-zinc-500">{active} settings — coming soon (V1 placeholder)</Card>}
          </div>
        </main>
      </div>
    </div>
  )
}
