"use client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs"
import { ArrowRight } from "lucide-react"

export function LandingHeaderAuth() {
  const { isSignedIn, isLoaded } = useUser() as any
  if (!isLoaded) return <div className="h-9 w-32 bg-gray-100 rounded animate-pulse" />
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
      <SignInButton mode="modal"><button className="text-sm text-zinc-600 hidden sm:block hover:text-zinc-900">Sign in</button></SignInButton>
      <SignUpButton mode="modal"><Button>Get Started Free</Button></SignUpButton>
    </>
  )
}

export function LandingHeroAuth() {
  const { isSignedIn, isLoaded } = useUser() as any
  if (!isLoaded) return <Button size="lg" disabled className="gap-2">Loading <ArrowRight className="w-4 h-4" /></Button>
  if (isSignedIn) {
    return <Link href="/onboarding"><Button size="lg" className="gap-2">Create Your Roadmap <ArrowRight className="w-4 h-4" /></Button></Link>
  }
  return <SignUpButton mode="modal"><Button size="lg" className="gap-2">Start Learning Free <ArrowRight className="w-4 h-4" /></Button></SignUpButton>
}

export function LandingCTAAuth() {
  const { isSignedIn } = useUser() as any
  if (isSignedIn) return <Link href="/onboarding"><Button variant="secondary">Go to Onboarding</Button></Link>
  return <SignUpButton mode="modal"><Button variant="secondary">Get Started Free</Button></SignUpButton>
}

export function HowItWorksAuth() {
  const { isSignedIn } = useUser() as any
  if (!isSignedIn) {
    return <SignUpButton mode="modal"><Button>Landing → Auth → Onboarding → Roadmap <ArrowRight className="w-4 h-4 ml-2" /></Button></SignUpButton>
  }
  return null
}
