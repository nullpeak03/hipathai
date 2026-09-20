"use client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useUser, UserButton } from "@clerk/nextjs"
import { ArrowRight } from "lucide-react"

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
