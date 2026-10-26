"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { useUser, UserButton } from "@clerk/nextjs"
import { ArrowRight, Menu, X } from "lucide-react"
import { InstallButton } from "@/components/pwa/install-app"
import { loadRoadmap } from "@/lib/store"
import landingStyles from "./landing-page.module.css"

/**
 * Whether the signed-in user already owns a roadmap. Cache-first for an
 * instant answer, then server truth (covers new devices with empty caches).
 * Null while unresolved — callers fall back to create-intent UI.
 */
function useHasRoadmap(active: boolean): boolean | null {
  const [has, setHas] = useState<boolean | null>(null)
  useEffect(() => {
    if (!active) return
    let cancelled = false
    try {
      if (loadRoadmap() && !cancelled) setHas(true)
    } catch {
      // fall through to network check
    }
    ;(async () => {
      try {
        const res = await fetch("/api/me/roadmap", { cache: "no-store" })
        const data = (await res.json().catch(() => null)) as { roadmap?: unknown } | null
        if (!cancelled && data) setHas(!!data.roadmap)
      } catch {
        // keep the cached answer (or null) on failure
      }
    })()
    return () => {
      cancelled = true
    }
  }, [active])
  return has
}

export function LandingHeaderAuth() {
  const { isSignedIn } = useUser()
  if (isSignedIn) {
    return (
      <>
        <Link href="/dashboard" className={landingStyles.dashboardButton}>Dashboard</Link>
        <UserButton />
      </>
    )
  }
  return (
    <>
      <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
      <Link href="/sign-up"><Button>Get Started Free</Button></Link>
    </>
  )
}

export function LandingHeroAuth() {
  const { isSignedIn } = useUser()
  const hasRoadmap = useHasRoadmap(!!isSignedIn)
  if (isSignedIn) {
    return (
      <span className="inline-flex flex-col sm:flex-row items-center gap-3">
        {hasRoadmap ? (
          <Link href="/dashboard"><Button size="lg" className="gap-2">Continue Learning <ArrowRight className="w-4 h-4" /></Button></Link>
        ) : (
          <Link href="/onboarding"><Button size="lg" className="gap-2">Create Your Roadmap <ArrowRight className="w-4 h-4" /></Button></Link>
        )}
        <InstallButton variant="outline" size="lg" />
      </span>
    )
  }
  return <Link href="/sign-up"><Button size="lg" className="gap-2">Start Learning Free <ArrowRight className="w-4 h-4" /></Button></Link>
}

export function LandingCTAAuth() {
  const { isSignedIn } = useUser()
  const hasRoadmap = useHasRoadmap(!!isSignedIn)
  if (isSignedIn) {
    return (
      <span className="inline-flex flex-col sm:flex-row items-center gap-3">
        {hasRoadmap ? (
          <Link href="/dashboard"><Button>Back to Dashboard</Button></Link>
        ) : (
          <Link href="/onboarding"><Button>Go to Onboarding</Button></Link>
        )}
        <InstallButton variant="outline" size="sm" />
      </span>
    )
  }
  return <Link href="/sign-up"><Button>Get Started Free</Button></Link>
}

export function HowItWorksAuth() {
  const { isSignedIn } = useUser()
  const hasRoadmap = useHasRoadmap(!!isSignedIn)
  if (!isSignedIn) {
    return <Link href="/sign-up"><Button>Landing → Auth → Onboarding → Roadmap <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
  }
  return hasRoadmap ? (
    <Link href="/dashboard"><Button>Back to Dashboard <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
  ) : (
    <Link href="/onboarding"><Button>Go to Onboarding <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
  )
}

/** Mobile menu: nav links + auth actions (the desktop header group is md+ only). */
export function LandingMobileMenu() {
  const { isSignedIn } = useUser()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const links = [
    { href: "#how-you-learn", label: "How you learn" },
    { href: "#mentor", label: "Mentor" },
    { href: "#faq", label: "FAQ" },
    { href: "/roadmaps", label: "Library" },
    { href: "/pricing", label: "Pricing" },
    { href: "/privacy", label: "Privacy" },
  ]
  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="p-2 rounded-lg border border-border bg-card"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={close} aria-hidden="true" />
          <div className="absolute right-4 top-16 z-30 w-60 rounded-xl border border-border bg-card shadow-xl p-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={close}
                className="block rounded-lg px-3 py-2.5 text-sm hover:bg-muted"
              >
                {l.label}
              </Link>
            ))}
            <div className="border-t border-border mt-1 pt-2 space-y-1">
              {isSignedIn ? (
                <Link href="/dashboard" onClick={close} className={`${landingStyles.dashboardButton} w-full`}>
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/sign-in" onClick={close} className="block rounded-lg px-3 py-2.5 text-sm hover:bg-muted">
                    Sign in
                  </Link>
                  <Link href="/sign-up" onClick={close} className="block px-1 pb-1">
                    <Button size="sm" className="w-full">Get Started Free</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
