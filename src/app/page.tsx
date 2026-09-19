import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CheckCircle2, BookOpen, Bot, Target, Sparkles, PlayCircle, Star, HelpCircle, Shield } from "lucide-react"
import { LandingHeaderAuth, LandingHeroAuth, LandingCTAAuth, HowItWorksAuth } from "@/components/landing/LandingAuth"

export const dynamic = "force-dynamic"

export default function Landing() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="h-16 border-b flex items-center justify-between px-6 max-w-7xl mx-auto w-full sticky top-0 bg-white/80 backdrop-blur z-20">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-[#6C5BFF] flex items-center justify-center text-white font-bold">H</div><span className="font-bold">HiPath AI</span></Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-600">
            <a href="#features" className="hover:text-zinc-900">Features</a>
            <a href="#how" className="hover:text-zinc-900">How it works</a>
            <a href="#faq" className="hover:text-zinc-900">FAQ</a>
            <Link href="/privacy" className="hover:text-zinc-900">Privacy</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <LandingHeaderAuth />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center">
        {/* Hero */}
        <div className="w-full max-w-7xl px-6 py-16 lg:py-24 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 text-xs bg-violet-50 border border-violet-200 rounded-full px-3 py-1 text-violet-700 mb-6">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> AI-Powered Learning Platform • CS & Technology
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl">
            Your Personal <span className="text-[#6C5BFF]">AI</span><br /> Learning Navigator
          </h1>
          <p className="mt-6 max-w-2xl text-zinc-600 text-base sm:text-lg">
            HiPath AI builds you a personalized roadmap, guides you day by day with AI tutoring, adapts to your weaknesses, and keeps you motivated — like having a mentor in your pocket.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <LandingHeroAuth />
            <a href="#features"><Button variant="outline" size="lg">Explore Features</Button></a>
          </div>
          <div className="mt-4 flex items-center gap-6 text-xs text-zinc-500">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> No credit card</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Free for V1</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Cancel anytime</span>
          </div>

          {/* Feature cards */}
          <div id="features" className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl text-left">
            {[
              { icon: Target, title: "Adaptive Roadmaps", desc: "Any CS goal → structured phases and lessons sized to your time, day-by-day guidance via Gemini AI. Flexible — adapts without code changes." },
              { icon: Bot, title: "Pocket Mentor", desc: "Persistent AI that teaches, quizzes, motivates & tracks weaknesses. Verified NVIDIA AI with automatic retries on hiccups." },
              { icon: BookOpen, title: "Learn by Doing", desc: "Teach → Example → Practice → Quiz. Unlock next only when you pass. +20 XP per lesson." },
            ].map(f => (
              <div key={f.title} className="rounded-2xl border p-6 bg-white hover:shadow-md transition">
                <f.icon className="w-8 h-8 text-[#6C5BFF] mb-3" />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-sm text-zinc-600 mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <section id="how" className="w-full bg-gray-50 border-y py-16">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-center">How it works</h2>
            <p className="text-center text-zinc-500 mt-2">Landing → Auth → Onboarding → Roadmap in 4 steps</p>
            <div className="grid md:grid-cols-4 gap-6 mt-10">
              {[
                { step:"01", title:"Sign up", desc:"Create account with Google/GitHub/Email via Clerk. Free.", icon: Shield },
                { step:"02", title:"Onboarding", desc:"Flexible 6-step wizard: Goal, Level, Time, Duration, Why, Style — custom inputs supported.", icon: Sparkles },
                { step:"03", title:"Generate", desc:"Gemini generates your roadmap (phases and lessons sized to your schedule) via Inngest, bypassing 10s limit.", icon: Target },
                { step:"04", title:"Learn daily", desc:"Sequential unlock — finish + pass quiz to unlock next. Mentor adapts to weaknesses.", icon: PlayCircle },
              ].map(s=> (
                <div key={s.step} className="bg-white rounded-2xl border p-6">
                  <div className="text-xs font-bold text-[#6C5BFF]">{s.step}</div>
                  <s.icon className="w-6 h-6 mt-2 text-zinc-700" />
                  <h3 className="font-semibold mt-3">{s.title}</h3>
                  <p className="text-sm text-zinc-600 mt-1">{s.desc}</p>
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
          <div className="rounded-2xl border bg-white overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center">
              <div><h3 className="font-semibold">Your roadmap, visualized</h3><p className="text-sm text-zinc-500">Flexible grid/list, accordion phases, DAG prerequisites</p></div>
              <Link href="/onboarding"><Button size="sm">Try it →</Button></Link>
            </div>
            <div className="p-6 bg-gray-50 grid md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border p-4 text-center"><div className="text-[#6C5BFF] font-bold">11%</div><div className="text-xs text-zinc-500">Complete</div></div>
              <div className="bg-white rounded-xl border p-4 text-center"><div className="font-bold">40</div><div className="text-xs text-zinc-500">Lessons</div></div>
              <div className="bg-white rounded-xl border p-4 text-center"><div className="font-bold">8 days</div><div className="text-xs text-zinc-500">Streak</div></div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="w-full bg-gray-50 border-y py-16">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-center">Loved by learners</h2>
            <div className="grid md:grid-cols-3 gap-6 mt-8">
              {[
                { name:"Aisha, CS Student", text:"HiPath turned my vague 'learn AI' into a clear 8-week plan. The mentor actually remembers my weak topics." },
                { name:"Rohan, Career Switcher", text:"Sequential unlock kept me accountable. I finally finished DSA without binge-skipping." },
                { name:"Maya, Dev", text:"Generation just works — and when the AI hiccups, it retries instead of leaving me hanging." },
              ].map(t=> (
                <div key={t.name} className="bg-white rounded-2xl border p-6">
                  <div className="flex gap-1 mb-3">{Array.from({length:5}).map((_,i)=> <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}</div>
                  <p className="text-sm text-zinc-600">“{t.text}”</p>
                  <p className="text-xs font-medium mt-3">{t.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="w-full max-w-3xl px-6 py-16">
          <h2 className="text-2xl font-bold text-center">FAQ</h2>
          <div className="mt-8 space-y-4">
            {[
              { q:"Is it really free?", a:"Yes, V1 is free. No credit card. Billing is hidden for now." },
              { q:"What happens after onboarding?", a:"We generate your roadmap via Gemini AI and save to Supabase. Takes ~30s via Inngest." },
              { q:"Can I edit my roadmap?", a:"Yes — flexible. Roadmap page has Edit/Pause/Delete. Edit reopens onboarding with your answers." },
              { q:"What about dark mode?", a:"Light only for now — dark coming later. All pages are light and fully responsive." },
            ].map(f=> (
              <div key={f.q} className="border rounded-xl p-4 bg-white">
                <h3 className="font-medium flex gap-2"><HelpCircle className="w-4 h-4 mt-0.5 text-[#6C5BFF]"/> {f.q}</h3>
                <p className="text-sm text-zinc-600 mt-2">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="w-full bg-[#6C5BFF] text-white py-12">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-2xl font-bold">Ready to start?</h2>
            <p className="text-white/80 mt-2">Landing → Auth → Onboarding → Roadmap. Your mentor awaits.</p>
            <div className="mt-6 flex justify-center gap-3">
              <LandingCTAAuth />
              <Link href="/privacy" className="text-sm underline self-center">Privacy</Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer with legal */}
      <footer className="border-t py-8 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-6 text-sm">
          <div>
            <div className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-[#6C5BFF] flex items-center justify-center text-white font-bold text-xs">H</div><span className="font-semibold">HiPath AI</span></div>
            <p className="text-zinc-500 mt-2 max-w-xs">Your Personal AI Learning Navigator — CS & Technology focus. Flexible, adaptive, mentor-driven.</p>
          </div>
          <div className="flex gap-12">
            <div className="space-y-2">
              <div className="font-medium">Product</div>
              <div className="flex flex-col gap-1 text-zinc-500">
                <a href="#features" className="hover:text-zinc-900">Features</a>
                <a href="#how" className="hover:text-zinc-900">How it works</a>
                <a href="#faq" className="hover:text-zinc-900">FAQ</a>
              </div>
            </div>
            <div className="space-y-2">
              <div className="font-medium">Legal</div>
              <div className="flex flex-col gap-1 text-zinc-500">
                <Link href="/privacy" className="hover:text-zinc-900">Privacy Policy</Link>
                <Link href="/terms" className="hover:text-zinc-900">Terms of Service</Link>
                <Link href="/cookies" className="hover:text-zinc-900">Cookie Policy</Link>
                <Link href="/contact" className="hover:text-zinc-900">Contact</Link>
              </div>
            </div>
          </div>
        </div>
        <div className="text-center text-xs text-zinc-400 mt-8">© 2026 HiPath AI — All rights reserved. Light theme only.</div>
      </footer>
    </div>
  )
}
