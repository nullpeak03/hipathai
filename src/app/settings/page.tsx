"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { loadGam } from "@/lib/store"
import { SETTINGS_TABS } from "@/lib/settings.config"
import { useUser } from "@clerk/nextjs"
import { useSearchParams, useRouter } from "next/navigation"

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useUser() as any
  const initialTab = searchParams.get("tab") || "profile"
  const [active, setActive] = useState(initialTab)
  const [gam, setGam] = useState({level:1, xp:0, streak:0, bestStreak:0})
  useEffect(()=> { setGam(loadGam() as any) }, [])
  useEffect(()=> {
    const t = searchParams.get("tab")
    if (t) setActive(t)
  }, [searchParams])

  const setTab = (id: string) => {
    setActive(id)
    router.push(`/settings?tab=${id}`, { scroll: false })
  }

  const enabledTabs = SETTINGS_TABS.filter(t=> t.enabled)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-zinc-500">Manage your account and preferences — flexible, config-driven</p>
          <div className="flex gap-6 border-b mt-6 overflow-x-auto">
            {enabledTabs.map(t=> (
              <button key={t.id} onClick={()=> setTab(t.id)} className={`pb-3 text-sm whitespace-nowrap border-b-2 capitalize ${active===t.id?"border-[#6C5BFF] text-[#6C5BFF] font-medium":"border-transparent text-zinc-500"}`}>{t.label} {t.soon && <span className="text-[10px]"> (soon)</span>}</button>
            ))}
          </div>
          <div className="mt-6">
            {active==="profile" && (
              <Card className="p-6">
                <h3 className="font-semibold">Profile</h3>
                {user ? (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center gap-4">
                      {user.imageUrl ? <img src={user.imageUrl} alt="avatar" className="w-16 h-16 rounded-full border"/> : <div className="w-16 h-16 rounded-full bg-[#6C5BFF] text-white flex items-center justify-center text-xl font-bold">{user.firstName?.[0]}</div>}
                      <div><div className="font-semibold">{user.fullName || user.firstName}</div><div className="text-sm text-zinc-500">{user.primaryEmailAddress?.emailAddress}</div></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-gray-50 rounded-xl"><div className="font-bold text-[#6C5BFF]">Lv.{gam.level}</div><div className="text-xs text-zinc-500">Level</div></div>
                      <div className="text-center p-4 bg-gray-50 rounded-xl"><div className="font-bold text-amber-600">{gam.xp}</div><div className="text-xs">XP Points</div></div>
                      <div className="text-center p-4 bg-gray-50 rounded-xl"><div className="font-bold">{gam.streak}d</div><div className="text-xs">Current Streak</div></div>
                      <div className="text-center p-4 bg-gray-50 rounded-xl"><div className="font-bold">{(gam as any).bestStreak ?? 0}d</div><div className="text-xs">Best Streak</div></div>
                    </div>
                    <p className="text-xs text-zinc-400">Edit profile in Clerk user menu. Flexible: add fields via <code>settings.config.ts</code>.</p>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-xl"><div className="font-bold text-[#6C5BFF]">Lv.{gam.level}</div><div className="text-xs text-zinc-500">Level</div></div>
                    <div className="text-center p-4 bg-gray-50 rounded-xl"><div className="font-bold text-amber-600">{gam.xp}</div><div className="text-xs">XP Points</div></div>
                    <div className="text-center p-4 bg-gray-50 rounded-xl"><div className="font-bold">{gam.streak}d</div><div className="text-xs">Current Streak</div></div>
                    <div className="text-center p-4 bg-gray-50 rounded-xl"><div className="font-bold">{(gam as any).bestStreak ?? 0}d</div><div className="text-xs">Best Streak</div></div>
                  </div>
                )}
              </Card>
            )}
            {active==="appearance" && <Card className="p-6"><h3 className="font-semibold">Appearance</h3><p className="text-sm text-zinc-500 mt-1">Light theme only for now — dark mode will come later.</p><div className="flex gap-3 mt-4"><button className="px-6 py-3 rounded-xl bg-[#6C5BFF] text-white text-sm">Light ✓</button><button disabled className="px-6 py-3 rounded-xl border bg-gray-100 text-zinc-400 text-sm cursor-not-allowed">Dark (soon)</button></div></Card>}
            {active==="account" && <Card className="p-6 text-sm text-zinc-500">Account settings — email, password via Clerk. Config-driven tab (see <code>settings.config.ts</code>).</Card>}
            {active==="notifications" && <Card className="p-6 text-sm text-zinc-500">Notifications — daily reminders, streak alerts. Toggle per channel (soon).</Card>}
            {active==="privacy" && <Card className="p-6 text-sm text-zinc-500">Privacy — data export, delete account. See <a href="/privacy" className="text-[#6C5BFF] underline">Privacy Policy</a>.</Card>}
            {!["profile","appearance","account","notifications","privacy"].includes(active) && <Card className="p-6 text-sm text-zinc-500">Unknown tab. Configure via <code>settings.config.ts</code>.</Card>}
          </div>
          <p className="text-xs text-zinc-400 mt-6">Flexible — toggle tabs in <code>src/lib/settings.config.ts</code> without code changes. URL sync <code>?tab=</code> enabled.</p>
        </main>
      </div>
    </div>
  )
}
