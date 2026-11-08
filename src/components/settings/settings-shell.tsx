"use client"

import { ShieldCheck } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Sidebar } from "@/components/layout/Sidebar"
import { PageTransition } from "@/components/motion/page-transition"
import { MobileSectionNav } from "@/components/settings/mobile-section-nav"
import { SectionHeader, type SaveStatus } from "@/components/settings/section-header"
import { SaveBar } from "@/components/settings/save-bar"
import {
  SETTINGS_GROUPS,
  getSection,
  sectionsInGroup,
  type SettingsSectionId,
} from "@/lib/settings.config"
import type { PreferenceSectionId } from "@/lib/settings-prefs"
import { cn } from "@/lib/utils"

type SettingsShellProps = {
  active: SettingsSectionId
  onNavigate: (id: SettingsSectionId) => void
  dirtySection: PreferenceSectionId | null
  saveStatus: SaveStatus
  saving: boolean
  showSaveBar: boolean
  onSave: () => void
  onDiscard: () => void
  children: React.ReactNode
}

export function SettingsShell({
  active,
  onNavigate,
  dirtySection,
  saveStatus,
  saving,
  showSaveBar,
  onSave,
  onDiscard,
  children,
}: SettingsShellProps) {
  const section = getSection(active)

  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6">
          <PageTransition>
            <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="t-caption">Your workspace</p>
                <h1 className="t-title mt-1 text-2xl sm:text-3xl">Settings</h1>
                <p className="t-caption mt-1 hidden max-w-2xl sm:block">
                  Make HiPath work the way you learn. Each section saves on its own, so nothing changes
                  until you say so.
                </p>
              </div>
              <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
                Private to your account
              </span>
            </header>

            <MobileSectionNav active={active} dirtySection={dirtySection} onNavigate={onNavigate} />

            <div className="mt-3 grid gap-5 lg:mt-5 lg:grid-cols-[264px_minmax(0,1fr)] lg:items-start">
              <aside className="hidden lg:sticky lg:top-20 lg:block">
                <nav
                  aria-label="Settings sections"
                  className="rounded-2xl border border-border bg-card p-2 shadow-sm"
                >
                  {SETTINGS_GROUPS.map((group) => (
                    <div key={group.id} className="pb-1 last:pb-0">
                      <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:pt-2">
                        {group.label}
                      </p>
                      {sectionsInGroup(group.id).map((item) => {
                        const isActive = active === item.id
                        const Icon = item.icon
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onNavigate(item.id)}
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                              "group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors",
                              isActive
                                ? "bg-primary/10 font-medium text-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                                isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {dirtySection === item.id ? (
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn-fg"
                                aria-label="Unsaved changes"
                              />
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </nav>
              </aside>

              <section aria-labelledby="settings-section-heading" className="min-w-0">
                <SectionHeader
                  icon={section.icon}
                  title={section.label}
                  description={section.description}
                  status={saveStatus}
                />
                <div className="mt-4 space-y-4">{children}</div>
                {showSaveBar ? (
                  <SaveBar
                    dirty={dirtySection !== null}
                    saving={saving}
                    saved={saveStatus === "saved"}
                    sectionLabel={section.label}
                    onSave={onSave}
                    onDiscard={onDiscard}
                  />
                ) : null}
              </section>
            </div>
          </PageTransition>
        </main>
      </div>
    </div>
  )
}
