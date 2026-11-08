"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Sidebar } from "@/components/layout/Sidebar"
import { AccountSecurity } from "@/components/settings/account-security"
import { AccessibilitySettings } from "@/components/settings/accessibility-settings"
import { AppInstall } from "@/components/settings/app-install"
import { AppearanceSettings } from "@/components/settings/appearance-settings"
import { LearningPreferences } from "@/components/settings/learning-preferences"
import { NotificationSettings } from "@/components/settings/notification-settings"
import { PlanBilling } from "@/components/settings/plan-billing"
import { PreferencesProvider, usePreferences } from "@/components/settings/preferences-provider"
import { PrivacyData } from "@/components/settings/privacy-data"
import { ProfileOverview } from "@/components/settings/profile-overview"
import type { SaveStatus } from "@/components/settings/section-header"
import { SettingsShell } from "@/components/settings/settings-shell"
import { UnsavedChangesDialog } from "@/components/settings/unsaved-changes-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getSection, normalizeSection, type SettingsSectionId } from "@/lib/settings.config"
import { isPreferenceSection, type PreferenceSectionId } from "@/lib/settings-prefs"
import { FRESH_GAM, loadGam, loadGamAsync, type Gamification } from "@/lib/store"

type PendingDestination =
  | { kind: "section"; id: SettingsSectionId; label: string }
  | { kind: "href"; href: string; label: string }

function PreferencesSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading preferences">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="p-4 sm:p-5">
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-10 w-full animate-pulse rounded-lg bg-muted" />
        </Card>
      ))}
    </div>
  )
}

function PreferencesError({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <Card className="p-4 sm:p-5" role="alert">
      <h3 className="text-sm font-semibold">Could not load your preferences</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {message ?? "Check your connection and try again."} You can still manage your account, theme, and
        installed app.
      </p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Try again
      </Button>
    </Card>
  )
}

function SettingsView({ gam, gamLoaded }: { gam: Gamification; gamLoaded: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    draft,
    loadState,
    loadError,
    dirty,
    savingSection,
    justSaved,
    saveSection,
    discardSection,
    reload,
  } = usePreferences()

  const [active, setActive] = useState<SettingsSectionId>(() =>
    normalizeSection(searchParams.get("tab"))
  )
  const [pending, setPending] = useState<PendingDestination | null>(null)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    setActive(normalizeSection(searchParams.get("tab")))
  }, [searchParams])

  const activePreferenceSection: PreferenceSectionId | null = isPreferenceSection(active) ? active : null
  const isDirty = activePreferenceSection !== null && dirty[activePreferenceSection] === true
  const isSaving = activePreferenceSection !== null && savingSection === activePreferenceSection
  const isSaved = activePreferenceSection !== null && justSaved === activePreferenceSection && !isDirty
  const saveStatus: SaveStatus = isDirty ? (isSaving ? "saving" : "dirty") : isSaved ? "saved" : "idle"

  const focusHeading = useCallback(() => {
    requestAnimationFrame(() => {
      document.getElementById("settings-section-heading")?.focus()
    })
  }, [])

  const commit = useCallback(
    (id: SettingsSectionId) => {
      setActive(id)
      router.replace(`/settings?tab=${id}`, { scroll: false })
      focusHeading()
    },
    [router, focusHeading]
  )

  const requestNavigate = useCallback(
    (id: SettingsSectionId) => {
      if (id === active) {
        focusHeading()
        return
      }
      if (isDirty) {
        setPending({ kind: "section", id, label: getSection(id).label })
        return
      }
      commit(id)
    },
    [active, isDirty, commit, focusHeading]
  )

  const finishPending = useCallback(() => {
    const target = pending
    setPending(null)
    if (!target) return
    if (target.kind === "section") commit(target.id)
    else router.push(target.href)
  }, [pending, commit, router])

  const saveAndLeave = useCallback(async () => {
    if (!activePreferenceSection) {
      finishPending()
      return
    }
    setLeaving(true)
    const saved = await saveSection(activePreferenceSection)
    setLeaving(false)
    if (saved) finishPending()
  }, [activePreferenceSection, saveSection, finishPending])

  const discardAndLeave = useCallback(() => {
    if (activePreferenceSection) discardSection(activePreferenceSection)
    finishPending()
  }, [activePreferenceSection, discardSection, finishPending])

  // Guard same-origin links while a preference section has unsaved edits.
  useEffect(() => {
    if (!isDirty) return
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest("a[href]")
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return

      event.preventDefault()
      event.stopPropagation()
      setPending({
        kind: "href",
        href: `${url.pathname}${url.search}${url.hash}`,
        label: anchor.textContent?.trim() || url.pathname,
      })
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [isDirty])

  // Guard tab close and reload.
  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [isDirty])

  // Ctrl/Cmd+S saves the active preference section.
  useEffect(() => {
    if (!activePreferenceSection) return
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        if (isDirty && !isSaving) void saveSection(activePreferenceSection)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [activePreferenceSection, isDirty, isSaving, saveSection])

  const preferencesLoading = loadState === "loading"
  const preferencesFailed = loadState === "error"

  let content: React.ReactNode
  switch (active) {
    case "profile":
      content = (
        <ProfileOverview gam={gam} loaded={gamLoaded} onEditProfile={() => requestNavigate("account")} />
      )
      break
    case "account":
      content = <AccountSecurity />
      break
    case "learning":
      content = preferencesLoading ? (
        <PreferencesSkeleton />
      ) : preferencesFailed ? (
        <PreferencesError message={loadError} onRetry={() => void reload()} />
      ) : draft ? (
        <LearningPreferences />
      ) : (
        <PreferencesSkeleton />
      )
      break
    case "notifications":
      content = preferencesLoading ? (
        <PreferencesSkeleton />
      ) : preferencesFailed ? (
        <PreferencesError message={loadError} onRetry={() => void reload()} />
      ) : draft ? (
        <NotificationSettings onManageEmail={() => requestNavigate("account")} />
      ) : (
        <PreferencesSkeleton />
      )
      break
    case "accessibility":
      content = preferencesLoading ? (
        <PreferencesSkeleton />
      ) : preferencesFailed ? (
        <PreferencesError message={loadError} onRetry={() => void reload()} />
      ) : draft ? (
        <AccessibilitySettings />
      ) : (
        <PreferencesSkeleton />
      )
      break
    case "appearance":
      content = <AppearanceSettings />
      break
    case "app":
      content = <AppInstall />
      break
    case "privacy":
      content = <PrivacyData />
      break
    case "billing":
      content = <PlanBilling />
      break
    default:
      content = null
  }

  return (
    <>
      <SettingsShell
        active={active}
        onNavigate={requestNavigate}
        dirtySection={isDirty ? activePreferenceSection : null}
        saveStatus={saveStatus}
        saving={isSaving || leaving}
        showSaveBar={activePreferenceSection !== null && loadState === "ready"}
        onSave={() => {
          if (activePreferenceSection) void saveSection(activePreferenceSection)
        }}
        onDiscard={() => {
          if (activePreferenceSection) discardSection(activePreferenceSection)
        }}
      >
        {content}
      </SettingsShell>

      <UnsavedChangesDialog
        open={pending !== null}
        destination={pending?.label ?? "This page"}
        saving={leaving || isSaving}
        onSave={() => void saveAndLeave()}
        onDiscard={discardAndLeave}
        onStay={() => setPending(null)}
      />
    </>
  )
}

function SettingsContent() {
  const [gam, setGam] = useState<Gamification>(FRESH_GAM)
  const [gamLoaded, setGamLoaded] = useState(false)

  useEffect(() => {
    setGam(loadGam())
    let cancelled = false
    void loadGamAsync()
      .then((value) => {
        if (!cancelled) {
          setGam(value)
          setGamLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setGamLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <PreferencesProvider>
      <SettingsView gam={gam} gamLoaded={gamLoaded} />
    </PreferencesProvider>
  )
}

function SettingsFallback() {
  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
          <div className="mt-6 grid gap-5 lg:grid-cols-[264px_minmax(0,1fr)]">
            <div className="hidden h-80 animate-pulse rounded-2xl border border-border bg-muted/50 lg:block" />
            <div className="space-y-4">
              <div className="h-40 animate-pulse rounded-2xl border border-border bg-muted/50" />
              <div className="h-56 animate-pulse rounded-2xl border border-border bg-muted/50" />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsFallback />}>
      <SettingsContent />
    </Suspense>
  )
}
