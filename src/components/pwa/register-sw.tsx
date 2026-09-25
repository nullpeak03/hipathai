"use client"
import { useEffect } from "react"

/**
 * Registers the Serwist service worker in production only. Manual
 * registration (instead of the plugin's auto mode) — the auto mode
 * silently shipped zero registration code (no beforeinstallprompt ever).
 */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Offline-first is enhancement-only; the app works fully without it.
    })
  }, [])
  return null
}
