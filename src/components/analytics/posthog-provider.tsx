"use client"
import { Suspense, useEffect, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import posthog from "posthog-js"

let initialized = false

function isSensitiveTokenPath(pathname: string): boolean {
  return /^\/pricing\/(?:confirm|remove)\/[^/]+\/?$/.test(pathname)
}

function initPostHog() {
  if (initialized || typeof window === "undefined" || isSensitiveTokenPath(window.location.pathname)) return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (!key || !host) return // analytics stays off without keys
  posthog.init(key, {
    api_host: host,
    person_profiles: "identified_only",
    capture_pageview: false, // manual pageviews below (SPA-safe)
    autocapture: false,
  })
  initialized = true
}

/** Fire-and-forget product event (no-op when PostHog is unconfigured). */
export function trackEvent(event: string, props?: Record<string, unknown>) {
  try {
    if (initialized && !isSensitiveTokenPath(window.location.pathname)) posthog.capture(event, props)
  } catch {
    // analytics must never break the app
  }
}

function PageViewTracker() {
  const pathname = usePathname()
  useEffect(() => {
    initPostHog()
    try {
      if (initialized) {
        if (isSensitiveTokenPath(pathname)) return
        posthog.capture("$pageview", { $current_url: pathname })
      }
    } catch {
      // ignore
    }
  }, [pathname])
  return null
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      {children}
    </>
  )
}
