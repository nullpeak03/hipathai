"use client"
import { ThemeProvider } from "next-themes"
import { ToastProvider } from "./ui/toast"
import { AnalyticsProvider } from "./analytics/posthog-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      themes={["light", "dark", "matrix", "system"]}
    >
      <ToastProvider>
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
