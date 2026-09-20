"use client"
import { ToastProvider } from "./ui/toast"
import { AnalyticsProvider } from "./analytics/posthog-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  // Light only — no ThemeProvider, forced light
  return (
    <ToastProvider>
      <AnalyticsProvider>{children}</AnalyticsProvider>
    </ToastProvider>
  )
}
