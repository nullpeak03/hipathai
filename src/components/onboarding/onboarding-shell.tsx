"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/brand/logo"

export function OnboardingShell({
  step,
  title,
  subtitle,
  children,
}: {
  step: number
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  const progress = Math.round((step / 6) * 100)

  return (
    <main className="min-h-screen overflow-hidden bg-[#080d1c] text-white">
      <div className="grid min-h-screen lg:grid-cols-[0.85fr_1.15fr]">
        <aside className="relative hidden overflow-hidden border-r border-white/10 bg-[#101828] p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -left-28 top-20 h-72 w-72 rounded-full bg-[#7C5CFC]/30 blur-3xl" />
          <div className="absolute -right-24 bottom-20 h-80 w-80 rounded-full bg-[#55D6FF]/20 blur-3xl" />
          <div className="relative">
            <Logo href="/onboarding/step/1" className="text-white" />
            <div className="mt-24 max-w-sm">
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-[#55D6FF]">Your path, made personal</p>
              <h1 className="mt-5 text-5xl font-semibold leading-[1.05] tracking-tight">
                Build momentum that lasts.
              </h1>
              <p className="mt-6 text-base leading-7 text-slate-300">
                A few quick choices help us shape the right pace, practice, and roadmap for you.
              </p>
            </div>
          </div>
          <div className="relative">
            <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
              <span>Personalizing your experience</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-[#7C5CFC] to-[#55D6FF] transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-5 flex gap-2">
              {Array.from({ length: 6 }, (_, index) => (
                <span key={index} className={`h-1 flex-1 rounded-full ${index < step ? "bg-[#55D6FF]" : "bg-white/10"}`} />
              ))}
            </div>
          </div>
        </aside>

        <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-10">
          <div className="w-full max-w-xl">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <Logo href="/onboarding/step/1" className="text-white" />
              <span className="text-sm text-slate-400">{step} / 6</span>
            </div>
            <div className="mb-8">
              <div className="mb-3 flex items-center justify-between text-sm text-slate-400">
                <span>Step {step} of 6</span>
                <span className="text-[#55D6FF]">{progress}% complete</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-[#7C5CFC] to-[#55D6FF]" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-10">
              <div className="mb-9">
                <p className="mb-3 text-sm font-medium text-[#55D6FF]">Let&apos;s make this yours</p>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
                <p className="mt-3 text-slate-400">{subtitle}</p>
              </div>
              {children}
            </div>
            <p className="mt-5 text-center text-xs text-slate-500">You can adjust these preferences anytime.</p>
          </div>
        </section>
      </div>
    </main>
  )
}

export function OnboardingBackLink({ href }: { href: string }) {
  return <Link href={href} className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> Back</Link>
}
