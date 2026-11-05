"use client"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { X, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LESSON_PASS_THRESHOLD, V2_MASTERY_THRESHOLD } from "@/lib/v2-mastery"

const STEPS = [
  "Create your first roadmap",
  "Complete your first lesson",
  `Pass a lesson quiz with ${LESSON_PASS_THRESHOLD}%`,
  `Build toward ${V2_MASTERY_THRESHOLD}% mastery with practice and review`,
  "Review a weak area with the tutor",
]

/**
 * Onboarding checklist for signed-in app pages. It must not render on the
 * public marketing site, and it waits for the analytics choice so it never
 * stacks on top of the consent banner in the same corner.
 */
const APP_ROUTE_PREFIXES = [
  "/dashboard",
  "/roadmap",
  "/tutor",
  "/review",
  "/settings",
  "/analytics",
  "/onboarding",
  "/code-e",
  "/start",
]

export function GuidanceBox() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [consentResolved, setConsentResolved] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem("hipath_guidance_dismissed") === "1") {
        setDismissed(true)
        return
      }
      setConsentResolved(localStorage.getItem("hipath_analytics_consent") != null)
      setVisible(true)
    } catch {
      setVisible(true)
      setConsentResolved(true)
    }

    const onConsent = () => setConsentResolved(true)
    window.addEventListener("hipath:consent", onConsent)
    return () => window.removeEventListener("hipath:consent", onConsent)
  }, [])

  const isAppRoute = APP_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )

  const dismiss = () => {
    try { localStorage.setItem("hipath_guidance_dismissed", "1") } catch {}
    setVisible(false)
    setDismissed(true)
  }

  if (!isAppRoute || dismissed || !visible || !consentResolved) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card shadow-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Getting started</div>
          <p className="text-xs text-muted-foreground mt-1">Follow these steps to begin learning.</p>
        </div>
        <button onClick={dismiss} aria-label="Dismiss guidance" className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {STEPS.map((step) => (
          <li key={step} className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>{step}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end">
        <Button size="sm" variant="outline" onClick={dismiss}>Skip</Button>
      </div>
    </div>
  )
}
