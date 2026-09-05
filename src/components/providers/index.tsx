"use client"

import { ClerkProvider } from "@clerk/nextjs"
import { useAuth } from "@clerk/nextjs"
import { shadcn } from "@clerk/ui/themes"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { ToastProvider } from "@/components/ui/toast"
import { setSupabaseAccessToken } from "@/lib/supabase/client"
import { useEffect } from "react"

function SupabaseTokenBridge() {
  const { getToken, isLoaded, isSignedIn } = useAuth()

  useEffect(() => {
    let cancelled = false

    if (!isLoaded || !isSignedIn) {
      setSupabaseAccessToken(undefined)
      return
    }

    void getToken({ template: "supabase" }).then((token) => {
      if (!cancelled) setSupabaseAccessToken(token ?? undefined)
    })

    return () => {
      cancelled = true
    }
  }, [getToken, isLoaded, isSignedIn])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      appearance={{ theme: shadcn }}
    >
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ToastProvider>
          <SupabaseTokenBridge />
          {children}
          <Toaster />
        </ToastProvider>
      </ThemeProvider>
    </ClerkProvider>
  )
}