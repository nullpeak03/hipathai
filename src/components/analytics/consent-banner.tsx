"use client"
import { useEffect, useState } from "react"
import { hasAnalyticsConsent, setAnalyticsConsent } from "./posthog-provider"

export function AnalyticsConsentBanner() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    try {
      if (localStorage.getItem("hipath_analytics_consent") == null) setShow(true)
    } catch {
      setShow(false)
    }
  }, [])
  if (!show) return null
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-2xl rounded-xl border border-border bg-card p-4 shadow-lg">
      <p className="text-sm">
        We use analytics to improve HiPath AI. You can opt in or out at any time.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          onClick={() => {
            setAnalyticsConsent(true)
            setShow(false)
          }}
        >
          Accept
        </button>
        <button
          className="rounded-md border border-border px-3 py-1.5 text-sm"
          onClick={() => {
            setAnalyticsConsent(false)
            setShow(false)
          }}
        >
          Decline
        </button>
      </div>
    </div>
  )
}