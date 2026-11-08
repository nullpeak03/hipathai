"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { Check, ChevronDown, X } from "lucide-react"
import { useAppMenuOpen } from "@/components/settings/use-app-menu-open"
import {
  SETTINGS_GROUPS,
  getSection,
  sectionsInGroup,
  type SettingsSectionId,
} from "@/lib/settings.config"
import type { PreferenceSectionId } from "@/lib/settings-prefs"
import { cn } from "@/lib/utils"

type MobileSectionNavProps = {
  active: SettingsSectionId
  dirtySection: PreferenceSectionId | null
  onNavigate: (id: SettingsSectionId) => void
}

/**
 * Mobile-only section switcher. A compact sticky trigger opens a bottom sheet
 * with the same groups as the desktop rail, so the OS-native select never
 * leaks Material styling into the app.
 */
export function MobileSectionNav({ active, dirtySection, onNavigate }: MobileSectionNavProps) {
  const section = getSection(active)
  const ActiveIcon = section.icon
  const groupLabel = SETTINGS_GROUPS.find((group) => group.id === section.group)?.label ?? "Settings"
  const appMenuOpen = useAppMenuOpen()

  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  // Never float over the app drawer. Derived value prevents a one-frame flash
  // when the drawer opens while the sheet is still true.
  const sheetVisible = open && !appMenuOpen

  useEffect(() => {
    if (appMenuOpen) setOpen(false)
  }, [appMenuOpen])

  const close = useCallback((restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus())
    }
  }, [])

  useEffect(() => {
    if (!sheetVisible) return
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = original
    }
  }, [sheetVisible])

  useEffect(() => {
    if (!sheetVisible) return
    const frame = requestAnimationFrame(() => {
      const current = panelRef.current?.querySelector<HTMLElement>('[data-current="true"]')
      ;(current ?? panelRef.current)?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [sheetVisible])

  useEffect(() => {
    if (!sheetVisible) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        close()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [sheetVisible, close])

  if (appMenuOpen) return null

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return
    const panel = panelRef.current
    if (!panel) return
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => element.offsetParent !== null)
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const select = (id: SettingsSectionId) => {
    setOpen(false)
    onNavigate(id)
  }

  return (
    <>
      <div className="sticky top-14 z-10 -mx-1 mt-3 bg-app/95 px-1 pb-1.5 pt-2 backdrop-blur-sm lg:hidden">
        <div className="rounded-2xl border border-border bg-card p-2 shadow-sm">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={sheetVisible}
            aria-controls="settings-section-sheet"
            aria-label={`Change settings section. Current section: ${section.label}`}
            className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ActiveIcon className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {groupLabel}
              </span>
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{section.label}</span>
                {dirtySection === active ? (
                  <>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn-fg" aria-hidden />
                    <span className="sr-only">Unsaved changes</span>
                  </>
                ) : null}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
          <p className="truncate px-2 pb-0.5 pt-0.5 text-[11px] text-muted-foreground">{section.description}</p>
        </div>
      </div>

      {mounted
        ? createPortal(
            // The portal must sit outside AnimatePresence: it is not a React
            // element, so AnimatePresence would filter it out and render nothing.
            <AnimatePresence>
              {sheetVisible ? (
                <div key="settings-section-sheet" className="fixed inset-0 z-50 lg:hidden">
                <motion.div
                  aria-hidden
                  className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => close()}
                />
                <motion.div
                  ref={panelRef}
                  id="settings-section-sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="settings-section-sheet-title"
                  tabIndex={-1}
                  onKeyDown={handleKeyDown}
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-3xl border-t border-border bg-card shadow-2xl outline-none"
                  style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
                >
                  <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />

                  <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 pb-3 pt-2.5">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Settings
                      </p>
                      <h2 id="settings-section-sheet-title" className="text-base font-semibold">
                        Jump to a section
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => close()}
                      aria-label="Close section picker"
                      className="-mr-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4 pt-1">
                    {SETTINGS_GROUPS.map((group) => {
                      const items = sectionsInGroup(group.id)
                      if (items.length === 0) return null
                      return (
                        <div key={group.id} className="pt-2 first:pt-1">
                          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {group.label}
                          </p>
                          <div className="space-y-0.5">
                            {items.map((item) => {
                              const isActive = item.id === active
                              const Icon = item.icon
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  data-current={isActive ? "true" : undefined}
                                  aria-current={isActive ? "page" : undefined}
                                  onClick={() => select(item.id)}
                                  className={cn(
                                    "flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                                    isActive
                                      ? "bg-primary/10 text-foreground"
                                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                                      isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground"
                                    )}
                                  >
                                    <Icon className="h-4 w-4" aria-hidden />
                                  </span>
                                  <span
                                    className={cn(
                                      "min-w-0 flex-1 truncate text-sm",
                                      isActive && "font-semibold"
                                    )}
                                  >
                                    {item.label}
                                  </span>
                                  {dirtySection === item.id ? (
                                    <>
                                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn-fg" aria-hidden />
                                      <span className="sr-only">Unsaved changes</span>
                                    </>
                                  ) : null}
                                  {isActive ? (
                                    <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                                  ) : null}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              </div>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </>
  )
}
