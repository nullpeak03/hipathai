"use client"
import { SignIn, SignUp, ClerkLoading, ClerkLoaded, ClerkFailed } from "@clerk/nextjs"
import { useTheme } from "next-themes"
import { useEffect, useState, type ComponentProps } from "react"
import { trackEvent } from "@/components/analytics/posthog-provider"

type SignInProps = ComponentProps<typeof SignIn>
type SignUpProps = ComponentProps<typeof SignUp>

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ""
const KEY_VALID = PUBLISHABLE_KEY.startsWith("pk_test_") || PUBLISHABLE_KEY.startsWith("pk_live_")

function AuthFallback() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm" aria-busy="true" aria-label="Loading sign-in form">
      <div className="animate-pulse space-y-3">
        <div className="h-5 bg-muted rounded w-2/3 mx-auto" />
        <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
        <div className="h-10 bg-muted rounded-lg" />
        <div className="h-10 bg-muted rounded-lg" />
        <div className="h-10 bg-muted rounded-lg" />
      </div>
      <p className="text-xs text-muted-foreground text-center mt-4">Loading secure sign-in…</p>
    </div>
  )
}

function AuthError({ onRetry, reason }: { onRetry: () => void; reason: "config" | "failed" | "timeout" }) {
  useEffect(() => {
    trackEvent("auth_load_failed", { reason })
  }, [reason])
  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm text-center" role="alert">
      <div className="text-4xl mb-3">🔒</div>
      <h3 className="font-semibold">Couldn&apos;t load sign-in</h3>
      <p className="text-sm text-muted-foreground mt-2">
        {reason === "config"
          ? "Authentication is misconfigured. Please contact support."
          : "Check your connection and try again."}
      </p>
      {reason !== "config" && (
        <p className="text-xs text-muted-foreground mt-2">
          Using an ad-blocker, VPN, or private DNS? Allow <b>hipathai.me</b> and{" "}
          <b>clerk.hipathai.me</b>, then retry.
        </p>
      )}
      <button onClick={onRetry} className="mt-4 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
        Retry
      </button>
    </div>
  )
}

/** Shows fallback while loading, error UI after timeout or bad config. */
function AuthShell({ children }: { children: React.ReactNode }) {
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 10000)
    return () => clearTimeout(t)
  }, [])
  if (!KEY_VALID) {
    return <AuthError reason="config" onRetry={() => window.location.reload()} />
  }
  return (
    <>
      <ClerkLoading>{timedOut ? <AuthError reason="timeout" onRetry={() => window.location.reload()} /> : <AuthFallback />}</ClerkLoading>
      <ClerkLoaded>{children}</ClerkLoaded>
      <ClerkFailed>
        <AuthError
          reason="failed"
          onRetry={() => window.location.reload()}
        />
      </ClerkFailed>
    </>
  )
}

/** Clerk auth cards themed to the active app theme (matrix gets green accents). */
export function ThemedSignIn(props: SignInProps) {
  const { resolvedTheme } = useTheme()
  return (
    <AuthShell>
      <SignIn appearance={authAppearance(resolvedTheme)} {...props} />
    </AuthShell>
  )
}

export function ThemedSignUp(props: SignUpProps) {
  const { resolvedTheme } = useTheme()
  return (
    <AuthShell>
      <SignUp appearance={authAppearance(resolvedTheme)} {...props} />
    </AuthShell>
  )
}

function authAppearance(resolvedTheme: string | undefined) {
  const base = { elements: { card: "shadow-sm border" } }
  if (resolvedTheme === "matrix") {
    return {
      ...base,
      variables: {
        colorBackground: "#000000",
        colorText: "#d6f5df",
        colorInputBackground: "#0a0f0b",
        colorInputText: "#d6f5df",
        colorPrimary: "#00E676",
      },
    }
  }
  if (resolvedTheme === "dark") {
    return {
      ...base,
      variables: {
        colorBackground: "#09090b",
        colorText: "#fafafa",
        colorInputBackground: "#18181b",
        colorInputText: "#fafafa",
        colorPrimary: "#6C5BFF",
      },
    }
  }
  return base
}
