"use client"
import { Suspense, useEffect, type ReactNode } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import posthog from "posthog-js"

let initialized = false

function initPostHog() {
  if (initialized || typeof window === "undefined") return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (!key || !host) return // analytics stays off without keys
  posthog.init(key, {
    api_host: host,
    person_profiles: "identified_only",
    capture_pageview: false, // manual pageviews below (SPA-safe)
  })
  initialized = true
}

/** Fire-and-forget product event (no-op when PostHog is unconfigured). */
export function trackEvent(event: string, props?: Record<string, unknown>) {
  try {
    if (initialized) posthog.capture(event, props)
  } catch {
    // analytics must never break the app
  }
}

function PageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  useEffect(() => {
    initPostHog()
    try {
      if (initialized) {
        const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "")
        posthog.capture("$pageview", { $current_url: url })
      }
    } catch {
      // ignore
    }
  }, [pathname, searchParams])
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
