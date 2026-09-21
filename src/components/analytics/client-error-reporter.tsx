"use client"
import { useEffect } from "react"
import { trackEvent } from "./posthog-provider"

function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url, window.location.origin)
    return u.pathname.slice(0, 120)
  } catch {
    return "unknown"
  }
}

/**
 * Poor-man's error tracking (we run PostHog-only, no Sentry): forwards
 * window errors + unhandled rejections as analytics events so device-specific
 * failures show up in the dashboard instead of vanishing silently.
 */
export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      trackEvent("client_error", {
        message: String(e.message || "unknown").slice(0, 200),
        source: typeof e.filename === "string" ? e.filename.split("/").pop() : undefined,
        route: sanitizeUrl(window.location.href),
      })
    }
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason as unknown
      trackEvent("client_error", {
        message: String(
          (reason instanceof Error ? reason.message : reason) ?? "unhandled rejection"
        ).slice(0, 200),
        route: sanitizeUrl(window.location.href),
      })
    }
    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])
  return null
}
