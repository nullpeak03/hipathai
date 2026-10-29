"use client"
import { ThemeProvider } from "next-themes"
import { MotionConfig } from "framer-motion"
import { ToastProvider } from "./ui/toast"
import { AnalyticsProvider } from "./analytics/posthog-provider"
import { ClientErrorReporter } from "./analytics/client-error-reporter"
import { AnalyticsConsentBanner } from "./analytics/consent-banner"
import { AuraCursor } from "./effects/aura-cursor"
import { ScrollReveal } from "./effects/scroll-reveal"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      themes={["light", "dark", "matrix", "system"]}
    >
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <AnalyticsProvider>{children}</AnalyticsProvider>
          <AnalyticsConsentBanner />
          <ScrollReveal />
          <ClientErrorReporter />
          <AuraCursor />
        </ToastProvider>
      </MotionConfig>
    </ThemeProvider>
  )
}
