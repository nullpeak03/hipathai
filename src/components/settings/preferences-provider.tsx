"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useToast } from "@/components/ui/toast"
import {
  PREFERENCE_SECTION_IDS,
  PREFERENCE_SECTIONS,
  applyAccessibilityPrefs,
  diffSectionPreferences,
  isSectionDirty,
  normalizePreferences,
  sanitizeSectionPatch,
  type PreferenceSectionId,
  type Preferences,
} from "@/lib/settings-prefs"

type LoadState = "loading" | "ready" | "error"

type PreferencesContextValue = {
  prefs: Preferences | null
  draft: Preferences | null
  loadState: LoadState
  loadError: string | null
  dirty: Partial<Record<PreferenceSectionId, boolean>>
  hasUnsavedChanges: boolean
  savingSection: PreferenceSectionId | null
  justSaved: PreferenceSectionId | null
  updatePreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
  discardSection: (section: PreferenceSectionId) => void
  saveSection: (section: PreferenceSectionId) => Promise<boolean>
  reload: () => Promise<void>
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [draft, setDraft] = useState<Preferences | null>(null)
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingSection, setSavingSection] = useState<PreferenceSectionId | null>(null)
  const [justSaved, setJustSaved] = useState<PreferenceSectionId | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestId.current
    setLoadState("loading")
    setLoadError(null)
    try {
      const res = await fetch("/api/me/preferences", { cache: "no-store" })
      if (!res.ok) {
        throw new Error(
          res.status === 401 ? "Sign in again to load your settings." : "Could not load your settings."
        )
      }
      const next = normalizePreferences(await res.json())
      if (requestId.current !== id) return
      setPrefs(next)
      setDraft(next)
      setLoadState("ready")
      applyAccessibilityPrefs(next)
    } catch (error) {
      if (requestId.current !== id) return
      setLoadState("error")
      setLoadError(error instanceof Error ? error.message : "Could not load your settings.")
    }
  }, [])

  useEffect(() => {
    void load()
    return () => {
      requestId.current += 1
    }
  }, [load])

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current)
    }
  }, [])

  const updatePreference = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = { ...prev, [key]: value }
      // Accessibility changes preview live; Save persists them.
      if (key === "fontSize" || key === "reducedMotion" || key === "highContrast") {
        applyAccessibilityPrefs(next)
      }
      return next
    })
  }, [])

  const discardSection = useCallback(
    (section: PreferenceSectionId) => {
      if (!prefs) return
      setDraft((prev) => {
        if (!prev) return prev
        const next = { ...prev }
        const writable = next as unknown as Record<string, unknown>
        for (const field of PREFERENCE_SECTIONS[section]) {
          writable[field] = prefs[field]
        }
        if (section === "accessibility") applyAccessibilityPrefs(next)
        return next
      })
      setJustSaved(null)
    },
    [prefs]
  )

  const saveSection = useCallback(
    async (section: PreferenceSectionId): Promise<boolean> => {
      if (!draft || !prefs) return false
      const patch = sanitizeSectionPatch(section, diffSectionPreferences(prefs, draft, section))
      if (Object.keys(patch).length === 0) return true

      setSavingSection(section)
      try {
        const res = await fetch("/api/me/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        })
        if (!res.ok) throw new Error("save failed")

        const next = { ...prefs, ...patch }
        setPrefs(next)
        setDraft((prev) => {
          if (!prev) return next
          // Only apply saved values for fields that were not edited again
          // while the request was in flight.
          const merged = { ...prev }
          const writable = merged as unknown as Record<string, unknown>
          for (const key of Object.keys(patch) as (keyof Preferences)[]) {
            if (prev[key] === draft[key]) writable[key] = patch[key]
          }
          return merged
        })
        if (section === "accessibility") applyAccessibilityPrefs(next)

        setJustSaved(section)
        if (savedTimer.current) clearTimeout(savedTimer.current)
        savedTimer.current = setTimeout(() => setJustSaved(null), 2600)

        toast({ title: "Settings saved", message: "Your changes are live.", kind: "success" })
        return true
      } catch {
        toast({
          title: "Save failed",
          message: "Your changes are still here. Check your connection and try again.",
          kind: "error",
        })
        return false
      } finally {
        setSavingSection(null)
      }
    },
    [draft, prefs, toast]
  )

  const dirty = useMemo(() => {
    const result: Partial<Record<PreferenceSectionId, boolean>> = {}
    for (const section of PREFERENCE_SECTION_IDS) {
      result[section] = isSectionDirty(prefs, draft, section)
    }
    return result
  }, [prefs, draft])

  const value = useMemo<PreferencesContextValue>(
    () => ({
      prefs,
      draft,
      loadState,
      loadError,
      dirty,
      hasUnsavedChanges: PREFERENCE_SECTION_IDS.some((section) => dirty[section]),
      savingSection,
      justSaved,
      updatePreference,
      discardSection,
      saveSection,
      reload: load,
    }),
    [
      prefs,
      draft,
      loadState,
      loadError,
      dirty,
      savingSection,
      justSaved,
      updatePreference,
      discardSection,
      saveSection,
      load,
    ]
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider")
  return value
}
