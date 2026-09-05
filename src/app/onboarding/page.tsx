"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"

export default function OnboardingLayout() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // If accessing /onboarding directly, redirect to step 1
    if (pathname === "/onboarding") {
      router.push("/onboarding/step/1")
    }
  }, [pathname, router])

  return null
}