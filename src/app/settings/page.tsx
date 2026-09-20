"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/card"
import { useEffect, useState, Suspense } from "react"
import { loadGam } from "@/lib/store"
import { SETTINGS_TABS } from "@/lib/settings.config"
import { useSearchParams, useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import Image from "next/image"

function SettingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useUser()
  const initialTab = searchParams.get("tab") || "profile"
  const [active, setActive] = useState(initialTab)
  const [gam, setGam] = useState({level:1, xp:0, streak:0, bestStreak:0})
  const [prefs, setPrefs] = useState<{ email: string | null; emailReminders: boolean } | null>(null)
  const [prefsSaving, setPrefsSaving] = useState(false)
  useEffect(()=> {
    setGam(loadGam())
    // Notification preferences (graceful when signed out/offline)
    void fetch("/api/me/preferences", { cache: "no-store" })
      .then(async (res) => {
        if (res.ok) setPrefs((await res.json()) as { email: string | null; emailReminders: boolean })
      })
      .catch(()=>{})
  }, [])

  const toggleReminders = () => {
    if (!prefs || prefsSaving) return
    const next = !prefs.emailReminders
    setPrefs({ ...prefs, emailReminders: next })
    setPrefsSaving(true)
    void fetch("/api/me/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailReminders: next }),
    })
      .then((res) => { if (!res.ok) setPrefs({ ...prefs, emailReminders: !next }) })
      .catch(()=> setPrefs({ ...prefs, emailReminders: !next }))
      .finally(()=> setPrefsSaving(false))
  }
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
          <p className="text-sm text-zinc-500">Manage your account and preferences</p>
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
                      {user.imageUrl ? <Image src={user.imageUrl} alt="avatar" width={64} height={64} className="w-16 h-16 rounded-full border"/> : <div className="w-16 h-16 rounded-full bg-[#6C5BFF] text-white flex items-center justify-center text-xl font-bold">{user.firstName?.[0]}</div>}
                      <div><div className="font-semibold">{user.fullName || user.firstName}</div><div className="text-sm text-zinc-500">{user.primaryEmailAddress?.emailAddress}</div></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-gray-50 rounded-xl"><div className="font-bold text-[#6C5BFF]">Lv.{gam.level}</div><div className="text-xs text-zinc-500">Level</div></div>
                      <div className="text-center p-4 bg-gray-50 rounded-xl"><div className="font-bold text-amber-600">{gam.xp}</div><div className="text-xs">XP Points</div></div>
                      <div className="text-center p-4 bg-gray-50 rounded-xl"><div className="font-bold">{gam.streak}d</div><div className="text-xs">Current Streak</div></div>
                      <div className="text-center p-4 bg-gray-50 rounded-xl"><div className="font-bold">{gam.bestStreak ?? 0}d</div><div className="text-xs">Best Streak</div></div>
                    </div>
                    <p className="text-xs text-zinc-400">Edit profile in the Clerk user menu (top right).</p>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-xl"><div className="font-bold text-[#6C5BFF]">Lv.{gam.level}</div><div className="text-xs text-zinc-500">Level</div></div>
                    <div className="text-center p-4 bg-gray-50 rounded-xl"><div className="font-bold text-amber-600">{gam.xp}</div><div className="text-xs">XP Points</div></div>
                    <div className="text-center p-4 bg-gray-50 rounded-xl"><div className="font-bold">{gam.streak}d</div><div className="text-xs">Current Streak</div></div>
                    <div className="text-center p-4 bg-gray-50 rounded-xl"><div className="font-bold">{gam.bestStreak ?? 0}d</div><div className="text-xs">Best Streak</div></div>
                  </div>
                )}
              </Card>
            )}
            {active==="appearance" && <Card className="p-6"><h3 className="font-semibold">Appearance</h3><p className="text-sm text-zinc-500 mt-1">Light theme only for now — dark mode will come later.</p><div className="flex gap-3 mt-4"><button className="px-6 py-3 rounded-xl bg-[#6C5BFF] text-white text-sm">Light ✓</button><button disabled className="px-6 py-3 rounded-xl border bg-gray-100 text-zinc-400 text-sm cursor-not-allowed">Dark (soon)</button></div></Card>}
            {active==="account" && <Card className="p-6 text-sm text-zinc-500">Account settings — manage your email and password securely via Clerk.</Card>}
            {active==="notifications" && (
              <Card className="p-6">
                <h3 className="font-semibold">Notifications</h3>
                <p className="text-sm text-zinc-500 mt-1">One email per day max — a nudge when your streak is at risk. No spam, ever.</p>
                <div className="flex items-center justify-between gap-4 mt-4 rounded-xl border p-4">
                  <div>
                    <div className="text-sm font-medium">Streak reminders</div>
                    <div className="text-xs text-zinc-500">{prefs ? (prefs.email ?? "No email on file") : "Loading…"}</div>
                  </div>
                  <button
                    onClick={toggleReminders}
                    disabled={!prefs || prefsSaving}
                    role="switch"
                    aria-checked={prefs?.emailReminders ?? false}
                    className={`w-11 h-6 rounded-full transition-colors shrink-0 ${prefs?.emailReminders ? "bg-[#6C5BFF]" : "bg-gray-200"} ${!prefs || prefsSaving ? "opacity-50" : ""}`}
                  >
                    <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mt-0.5 ml-0.5 ${prefs?.emailReminders ? "translate-x-5" : ""}`} />
                  </button>
                </div>
              </Card>
            )}
            {active==="privacy" && <Card className="p-6 text-sm text-zinc-500">Privacy — data export, delete account. See <a href="/privacy" className="text-[#6C5BFF] underline">Privacy Policy</a>.</Card>}
            {!["profile","appearance","account","notifications","privacy"].includes(active) && <Card className="p-6 text-sm text-zinc-500">Unknown settings tab.</Card>}
          </div>
        </main>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen bg-gray-50"><div className="flex-1 p-8"><div className="animate-pulse h-8 bg-gray-200 rounded w-1/3"/></div></div>}>
      <SettingsContent />
    </Suspense>
  )
}
