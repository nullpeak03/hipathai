import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CheckCircle2, BookOpen, Bot, Target, Sparkles, PlayCircle, HelpCircle, Shield } from "lucide-react"
import { LandingHeaderAuth, LandingHeroAuth, LandingCTAAuth, HowItWorksAuth } from "@/components/landing/LandingAuth"

export const dynamic = "force-dynamic"

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-border flex items-center justify-between px-6 max-w-7xl mx-auto w-full sticky top-0 bg-card/80 backdrop-blur z-20">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">H</div><span className="font-bold">HiPath AI</span></Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <LandingHeaderAuth />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center">
        {/* Hero */}
        <div className="w-full max-w-7xl px-6 py-16 lg:py-24 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 text-xs bg-info-bg border border-info-border rounded-full px-3 py-1 text-info-fg mb-6">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> AI-Powered Learning Platform • CS & Technology
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl">
            Your Personal <span className="text-primary">AI</span><br /> Learning Navigator
          </h1>
          <p className="mt-6 max-w-2xl text-muted-foreground text-base sm:text-lg">
            HiPath AI builds you a personalized roadmap, guides you day by day with AI tutoring, adapts to your weaknesses, and keeps you motivated — like having a mentor in your pocket.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <LandingHeroAuth />
            <a href="#features"><Button variant="outline" size="lg">Explore Features</Button></a>
          </div>
          <div className="mt-4 flex items-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> No credit card</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Free for V1</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Cancel anytime</span>
          </div>

          {/* Feature cards */}
          <div id="features" className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl text-left">
            {[
              { icon: Target, title: "Adaptive Roadmaps", desc: "Any CS goal → structured phases and lessons sized to your time, with day-by-day guidance that adapts as you learn." },
              { icon: Bot, title: "Pocket Mentor", desc: "Persistent AI that teaches, quizzes, motivates & tracks weaknesses. Verified NVIDIA AI with automatic retries on hiccups." },
              { icon: BookOpen, title: "Learn by Doing", desc: "Teach → Example → Practice → Quiz. Unlock next only when you pass. +20 XP per lesson." },
            ].map(f => (
              <div key={f.title} className="rounded-2xl border p-6 bg-card hover:shadow-md transition">
                <f.icon className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <section id="how" className="w-full bg-muted border-y py-16">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-center">How it works</h2>
            <p className="text-center text-muted-foreground mt-2">Landing → Auth → Onboarding → Roadmap in 4 steps</p>
            <div className="grid md:grid-cols-4 gap-6 mt-10">
              {[
                { step:"01", title:"Sign up", desc:"Create account with Google/GitHub/Email via Clerk. Free.", icon: Shield },
                { step:"02", title:"Onboarding", desc:"Flexible 6-step wizard: Goal, Level, Time, Duration, Why, Style — custom inputs supported.", icon: Sparkles },
                { step:"03", title:"Generate", desc:"AI generates your roadmap (phases and lessons sized to your schedule) via Inngest, bypassing 10s limit.", icon: Target },
                { step:"04", title:"Learn daily", desc:"Sequential unlock — finish + pass quiz to unlock next. Mentor adapts to weaknesses.", icon: PlayCircle },
              ].map(s=> (
                <div key={s.step} className="bg-card rounded-2xl border p-6">
                  <div className="text-xs font-bold text-primary">{s.step}</div>
                  <s.icon className="w-6 h-6 mt-2 text-muted-foreground" />
                  <h3 className="font-semibold mt-3">{s.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <HowItWorksAuth />
            </div>
          </div>
        </section>

        {/* Demo / Roadmap preview */}
        <section className="w-full max-w-7xl px-6 py-16">
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <div><h3 className="font-semibold">Your roadmap, visualized</h3><p className="text-sm text-muted-foreground">Flexible grid/list, accordion phases, DAG prerequisites</p></div>
              <Link href="/onboarding"><Button size="sm">Try it →</Button></Link>
            </div>
            <div className="p-6 bg-muted grid md:grid-cols-3 gap-4">
              <div className="bg-card rounded-xl border p-4 text-center"><div className="text-primary font-bold">11%</div><div className="text-xs text-muted-foreground">Complete</div></div>
              <div className="bg-card rounded-xl border p-4 text-center"><div className="font-bold">40</div><div className="text-xs text-muted-foreground">Lessons</div></div>
              <div className="bg-card rounded-xl border p-4 text-center"><div className="font-bold">8 days</div><div className="text-xs text-muted-foreground">Streak</div></div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="w-full bg-muted border-y py-16">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-center">See it in action</h2>
            <p className="text-center text-muted-foreground mt-2">Real screens from the learning loop</p>
            <div className="grid md:grid-cols-3 gap-6 mt-8">
              <div className="bg-card rounded-2xl border p-6">
                <div className="rounded-xl bg-muted border p-4 space-y-2">
                  <div className="h-3 bg-primary rounded-full w-3/4" />
                  <div className="grid grid-cols-4 gap-1.5">
                    {["✓","2","3","4"].map((s,i)=> (
                      <div key={i} className={`h-9 rounded-lg flex items-center justify-center text-xs font-bold ${i===0 ? "bg-emerald-500 text-white" : i===1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{s}</div>
                    ))}
                  </div>
                  <div className="h-2 bg-muted rounded w-full" />
                  <div className="h-2 bg-muted rounded w-2/3" />
                </div>
                <h3 className="font-semibold mt-4">Adaptive roadmaps</h3>
                <p className="text-sm text-muted-foreground mt-1">Phases unlock as you pass quizzes — sized to your schedule, not a fixed template.</p>
              </div>
              <div className="bg-card rounded-2xl border p-6">
                <div className="rounded-xl bg-muted border p-4 space-y-2">
                  <div className="max-w-[80%] rounded-xl bg-primary text-primary-foreground text-xs px-3 py-2 ml-auto">Why did I fail closures?</div>
                  <div className="max-w-[85%] rounded-xl bg-card border text-xs px-3 py-2">Likely mixing scope with hoisting — retry the visual analogy in lesson 3…</div>
                  <div className="flex gap-1.5">
                    <div className="text-[10px] border border-danger-border bg-danger-bg text-danger-fg px-2 py-1 rounded-full">Closures · 2×</div>
                    <div className="text-[10px] border border-warn-border bg-warn-bg text-warn-fg px-2 py-1 rounded-full">Due review</div>
                  </div>
                </div>
                <h3 className="font-semibold mt-4">Mentor + weakness tracking</h3>
                <p className="text-sm text-muted-foreground mt-1">The tutor knows your roadmap and your weak areas — practice is targeted, not random.</p>
              </div>
              <div className="bg-card rounded-2xl border p-6">
                <div className="rounded-xl bg-muted border p-4">
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {["M","T","W","T","F","S","S"].map((d,i)=> (
                      <div key={i}>
                        <div className="text-[10px] text-muted-foreground">{d}</div>
                        <div className={`h-8 rounded-md mt-1 ${i<5 ? "bg-heat-3" : i===5 ? "bg-heat-2" : "bg-heat-0"}`} />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground mt-2"><span>142m this week</span><span>6-day streak</span></div>
                </div>
                <h3 className="font-semibold mt-4">Streaks that stick</h3>
                <p className="text-sm text-muted-foreground mt-1">Real study time, spaced reviews, and reminders keep momentum without guilt.</p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="w-full max-w-3xl px-6 py-16">
          <h2 className="text-2xl font-bold text-center">FAQ</h2>
          <div className="mt-8 space-y-4">
            {[
              { q:"Is it really free?", a:"Yes, V1 is free. No credit card. Billing is hidden for now." },
              { q:"What happens after onboarding?", a:"We generate your roadmap via AI and save to Supabase. Takes ~30s via Inngest." },
              { q:"Can I edit my roadmap?", a:"Yes — flexible. Roadmap page has Edit/Pause/Delete. Edit reopens onboarding with your answers." },
              { q:"What about dark mode?", a:"Light only for now — dark coming later. All pages are light and fully responsive." },
            ].map(f=> (
              <div key={f.q} className="border border-border rounded-xl p-4 bg-card">
                <h3 className="font-medium flex gap-2"><HelpCircle className="w-4 h-4 mt-0.5 text-primary"/> {f.q}</h3>
                <p className="text-sm text-muted-foreground mt-2">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="w-full bg-primary text-primary-foreground py-12">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-2xl font-bold">Ready to start?</h2>
            <p className="opacity-80 mt-2">Landing → Auth → Onboarding → Roadmap. Your mentor awaits.</p>
            <div className="mt-6 flex justify-center gap-3">
              <LandingCTAAuth />
              <Link href="/privacy" className="text-sm underline self-center">Privacy</Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer with legal */}
      <footer className="border-t border-border py-8 bg-card">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-6 text-sm">
          <div>
            <div className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">H</div><span className="font-semibold">HiPath AI</span></div>
            <p className="text-muted-foreground mt-2 max-w-xs">Your Personal AI Learning Navigator — CS & Technology focus. Flexible, adaptive, mentor-driven.</p>
          </div>
          <div className="flex gap-12">
            <div className="space-y-2">
              <div className="font-medium">Product</div>
              <div className="flex flex-col gap-1 text-muted-foreground">
                <a href="#features" className="hover:text-foreground">Features</a>
                <a href="#how" className="hover:text-foreground">How it works</a>
                <a href="#faq" className="hover:text-foreground">FAQ</a>
              </div>
            </div>
            <div className="space-y-2">
              <div className="font-medium">Legal</div>
              <div className="flex flex-col gap-1 text-muted-foreground">
                <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
                <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
                <Link href="/cookies" className="hover:text-foreground">Cookie Policy</Link>
                <Link href="/contact" className="hover:text-foreground">Contact</Link>
              </div>
            </div>
          </div>
        </div>
        <div className="text-center text-xs text-zinc-400 mt-8">© 2026 HiPath AI — All rights reserved. Light theme only.</div>
      </footer>
    </div>
  )
}
