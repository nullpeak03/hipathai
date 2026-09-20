"use client"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useUser, UserButton } from "@clerk/nextjs"
import { ArrowRight, Menu, X } from "lucide-react"

export function LandingHeaderAuth() {
  const { isSignedIn } = useUser()
  if (isSignedIn) {
    return (
      <>
        <Link href="/dashboard"><Button variant="outline" size="sm">Dashboard</Button></Link>
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
  if (isSignedIn) {
    return <Link href="/onboarding"><Button size="lg" className="gap-2">Create Your Roadmap <ArrowRight className="w-4 h-4" /></Button></Link>
  }
  return <Link href="/sign-up"><Button size="lg" className="gap-2">Start Learning Free <ArrowRight className="w-4 h-4" /></Button></Link>
}

export function LandingCTAAuth() {
  const { isSignedIn } = useUser()
  if (isSignedIn) return <Link href="/onboarding"><Button variant="secondary">Go to Onboarding</Button></Link>
  return <Link href="/sign-up"><Button variant="secondary">Get Started Free</Button></Link>
}

export function HowItWorksAuth() {
  const { isSignedIn } = useUser()
  if (!isSignedIn) {
    return <Link href="/sign-up"><Button>Landing → Auth → Onboarding → Roadmap <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
  }
  return <Link href="/onboarding"><Button>Go to Onboarding <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
}

/** Mobile menu: nav links + auth actions (the desktop header group is md+ only). */
export function LandingMobileMenu() {
  const { isSignedIn } = useUser()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const links = [
    { href: "#features", label: "Features" },
    { href: "#how", label: "How it works" },
    { href: "#faq", label: "FAQ" },
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
                <Link href="/dashboard" onClick={close}>
                  <Button variant="outline" size="sm" className="w-full">Dashboard</Button>
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
