"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useEffect, useState, Suspense } from "react"
import { loadGam } from "@/lib/store"
import { SETTINGS_TABS } from "@/lib/settings.config"
import { useSearchParams, useRouter } from "next/navigation"
import { useUser, useClerk, UserProfile } from "@clerk/nextjs"
import { useTheme } from "next-themes"
import { clerkThemeAppearance } from "@/components/auth/themed-auth"
import { useToast } from "@/components/ui/toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { loadRoadmapAsync, loadGamAsync, loadProgressAsync, loadWeakTopics } from "@/lib/store"
import Image from "next/image"

function AppearanceTab() {
  const { theme, setTheme } = useTheme()
  const options = [
    { value: "system", label: "System", desc: "Follows your device", swatch: "bg-gradient-to-br from-white to-zinc-900" },
    { value: "light", label: "Light", desc: "Classic bright", swatch: "bg-white" },
    { value: "dark", label: "Dark", desc: "Zinc-950 surfaces", swatch: "bg-zinc-950" },
    { value: "matrix", label: "Matrix", desc: "Black + terminal green", swatch: "bg-black" },
  ] as const
  return (
    <Card className="p-6">
      <h3 className="font-semibold">Appearance</h3>
      <p className="text-sm text-muted-foreground mt-1">Pick how HiPath looks. System follows your device.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {options.map((o) => {
          const selected = theme === o.value
          return (
            <button
              key={o.value}
              onClick={() => setTheme(o.value)}
              aria-pressed={selected}
              className={`rounded-xl border p-4 text-left transition ${selected ? "border-primary ring-2 ring-primary/20" : "hover:bg-muted"}`}
            >
              <div className={`h-10 rounded-lg border ${o.swatch} flex items-center justify-center`}>
                {o.value === "matrix" ? (
                  <span className="text-[#00E676] text-xs font-mono">&gt;_</span>
                ) : o.value === "dark" ? (
                  <span className="w-4 h-4 rounded-full bg-zinc-700" />
                ) : o.value === "light" ? (
                  <span className="w-4 h-4 rounded-full bg-amber-300" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-300 to-zinc-700" />
                )}
              </div>
              <div className="text-sm font-medium mt-2">{o.label} {selected && "✓"}</div>
              <div className="text-[11px] text-muted-foreground">{o.desc}</div>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function SettingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useUser()
  const initialTab = searchParams.get("tab") || "profile"
  const [active, setActive] = useState(initialTab)
  const [gam, setGam] = useState({level:1, xp:0, streak:0, bestStreak:0})
  const [prefs, setPrefs] = useState<{ email: string | null; emailReminders: boolean } | null>(null)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const toast = useToast()
  const { signOut } = useClerk()
  const { resolvedTheme } = useTheme()
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

  const exportData = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const [roadmap, gam, progress, weakTopics, threadsRes, activityRes, prefsRes] = await Promise.all([
        loadRoadmapAsync(),
        loadGamAsync(),
        loadProgressAsync(),
        loadWeakTopics(),
        fetch("/api/chat/threads", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/me/daily-activity?days=90", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/me/preferences", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ])
      const bundle = {
        exportedAt: new Date().toISOString(),
        profile: user ? {
          fullName: user.fullName,
          email: user.primaryEmailAddress?.emailAddress,
        } : null,
        gamification: gam,
        progress,
        roadmap,
        weakTopics,
        chatThreads: (threadsRes as { threads?: unknown } | null)?.threads ?? null,
        dailyActivity: (activityRes as { days?: unknown } | null)?.days ?? null,
        preferences: prefsRes,
      }
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `hipath-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast({ title: "Export ready", message: "Your data downloaded as JSON.", kind: "success" })
    } catch {
      toast({ title: "Export failed", message: "Could not assemble your data. Try again.", kind: "error" })
    } finally {
      setExporting(false)
    }
  }

  const deleteAccount = async () => {
    setDeletingAccount(true)
    try {
      const res = await fetch("/api/me/account", { method: "DELETE" })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        toast({ title: "Delete failed", message: data.error || "Could not delete your account.", kind: "error" })
        return
      }
      try { localStorage.clear() } catch {}
      try {
        if (signOut) await signOut(() => { window.location.href = "/" })
        else window.location.href = "/"
      } catch {
        window.location.href = "/"
      }
    } finally {
      setDeletingAccount(false)
      setConfirmDeleteAccount(false)
    }
  }

  const enabledTabs = SETTINGS_TABS.filter(t=> t.enabled)

  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
          <div className="flex gap-6 border-b border-border mt-6 overflow-x-auto">
            {enabledTabs.map(t=> (
              <button key={t.id} onClick={()=> setTab(t.id)} className={`pb-3 text-sm whitespace-nowrap border-b-2 capitalize ${active===t.id?"border-primary text-primary font-medium":"border-transparent text-muted-foreground"}`}>{t.label} {t.soon && <span className="text-[10px]"> (soon)</span>}</button>
            ))}
          </div>
          <div className="mt-6">
            {active==="profile" && (
              <Card className="p-6">
                <h3 className="font-semibold">Profile</h3>
                {user ? (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center gap-4">
                      {user.imageUrl ? <Image src={user.imageUrl} alt="avatar" width={64} height={64} className="w-16 h-16 rounded-full border border-border"/> : <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">{user.firstName?.[0]}</div>}
                      <div><div className="font-semibold">{user.fullName || user.firstName}</div><div className="text-sm text-muted-foreground">{user.primaryEmailAddress?.emailAddress}</div></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-muted rounded-xl"><div className="font-bold text-primary">Lv.{gam.level}</div><div className="text-xs text-muted-foreground">Level</div></div>
                      <div className="text-center p-4 bg-muted rounded-xl"><div className="font-bold text-amber-600">{gam.xp}</div><div className="text-xs">XP Points</div></div>
                      <div className="text-center p-4 bg-muted rounded-xl"><div className="font-bold">{gam.streak}d</div><div className="text-xs">Current Streak</div></div>
                      <div className="text-center p-4 bg-muted rounded-xl"><div className="font-bold">{gam.bestStreak ?? 0}d</div><div className="text-xs">Best Streak</div></div>
                    </div>
                    <p className="text-xs text-zinc-400">Edit profile in the Clerk user menu (top right).</p>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-muted rounded-xl"><div className="font-bold text-primary">Lv.{gam.level}</div><div className="text-xs text-muted-foreground">Level</div></div>
                    <div className="text-center p-4 bg-muted rounded-xl"><div className="font-bold text-amber-600">{gam.xp}</div><div className="text-xs">XP Points</div></div>
                    <div className="text-center p-4 bg-muted rounded-xl"><div className="font-bold">{gam.streak}d</div><div className="text-xs">Current Streak</div></div>
                    <div className="text-center p-4 bg-muted rounded-xl"><div className="font-bold">{gam.bestStreak ?? 0}d</div><div className="text-xs">Best Streak</div></div>
                  </div>
                )}
              </Card>
            )}
            {active==="appearance" && <AppearanceTab />}
            {active==="account" && (
              <div className="flex justify-center">
                <UserProfile routing="hash" appearance={clerkThemeAppearance(resolvedTheme)} />
              </div>
            )}
            {active==="notifications" && (
              <Card className="p-6">
                <h3 className="font-semibold">Notifications</h3>
                <p className="text-sm text-muted-foreground mt-1">One email per day max — a nudge when your streak is at risk. No spam, ever.</p>
                <div className="flex items-center justify-between gap-4 mt-4 rounded-xl border p-4">
                  <div>
                    <div className="text-sm font-medium">Streak reminders</div>
                    <div className="text-xs text-muted-foreground">{prefs ? (prefs.email ?? "No email on file") : "Loading…"}</div>
                  </div>
                  <button
                    onClick={toggleReminders}
                    disabled={!prefs || prefsSaving}
                    role="switch"
                    aria-checked={prefs?.emailReminders ?? false}
                    className={`w-11 h-6 rounded-full transition-colors shrink-0 ${prefs?.emailReminders ? "bg-primary" : "bg-muted"} ${!prefs || prefsSaving ? "opacity-50" : ""}`}
                  >
                    <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mt-0.5 ml-0.5 ${prefs?.emailReminders ? "translate-x-5" : ""}`} />
                  </button>
                </div>
              </Card>
            )}
            {active==="privacy" && (
              <Card className="p-6">
                <h3 className="font-semibold">Privacy</h3>
                <p className="text-sm text-muted-foreground mt-1">Your data, your call. See <a href="/privacy" className="text-primary underline">Privacy Policy</a>.</p>
                <div className="flex flex-wrap gap-3 mt-4">
                  <Button variant="outline" size="sm" onClick={()=> void exportData()} disabled={exporting}>
                    {exporting ? "Preparing…" : "Download my data (JSON)"}
                  </Button>
                  <Button variant="outline" size="sm" className="text-danger-fg border-danger-border" onClick={()=> setConfirmDeleteAccount(true)}>
                    Delete account…
                  </Button>
                </div>
                <ConfirmDialog
                  open={confirmDeleteAccount}
                  title="Delete your account?"
                  description="This permanently removes your profile, roadmaps, progress, chats, and streaks. This cannot be undone."
                  confirmLabel="Delete everything"
                  danger
                  busy={deletingAccount}
                  onConfirm={()=> void deleteAccount()}
                  onClose={()=> { if (!deletingAccount) setConfirmDeleteAccount(false) }}
                />
              </Card>
            )}
            {!["profile","appearance","account","notifications","privacy"].includes(active) && <Card className="p-6 text-sm text-muted-foreground">Unknown settings tab.</Card>}
          </div>
        </main>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen bg-app"><div className="flex-1 p-8"><div className="animate-pulse h-8 bg-muted rounded w-1/3"/></div></div>}>
      <SettingsContent />
    </Suspense>
  )
}
