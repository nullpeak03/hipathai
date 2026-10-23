"use client"
import { useEffect } from "react"

export function PreferencesApplier() {
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/me/preferences", { cache: "no-store" })
        if (!res.ok || cancelled) return
        const prefs = (await res.json()) as {
          fontSize?: number
          reducedMotion?: boolean
          highContrast?: boolean
        }
        const root = document.documentElement
        if (typeof prefs.fontSize === "number") root.style.fontSize = `${prefs.fontSize}px`
        root.classList.toggle("reduce-motion", prefs.reducedMotion === true)
        root.classList.toggle("high-contrast", prefs.highContrast === true)
        try {
          if (typeof prefs.fontSize === "number") localStorage.setItem("hipath_font_size", String(prefs.fontSize))
          localStorage.setItem("hipath_reduced_motion", prefs.reducedMotion ? "1" : "0")
          localStorage.setItem("hipath_high_contrast", prefs.highContrast ? "1" : "0")
        } catch {}
      } catch {
        // offline — keep current settings
      }
    })()
    return () => { cancelled = true }
  }, [])
  return null
}
