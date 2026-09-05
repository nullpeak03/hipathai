import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/brand/logo"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Brain,
  Target,
  Zap,
  BarChart,
  Users,
  MessageSquare,
  ArrowRight,
  CheckCircle,
  Shield,
  Sparkles,
  ArrowUpRight,
} from "lucide-react"

const features = [
  {
    icon: Brain,
    title: "Adaptive Roadmaps",
    description: "AI generates personalized learning paths that adapt based on your progress, weaknesses, and goals.",
  },
  {
    icon: Target,
    title: "Weakness Detection",
    description: "Automatically identifies knowledge gaps through quiz performance and adjusts your roadmap in real-time.",
  },
  {
    icon: Zap,
    title: "Smart Quiz Generation",
    description: "Multiple choice, code exercises, and short answer questions with adaptive difficulty and spaced repetition.",
  },
  {
    icon: MessageSquare,
    title: "AI Tutor",
    description: "Chat with an AI tutor that knows your roadmap, explains concepts, generates practice, and debugs code.",
  },
  {
    icon: BarChart,
    title: "Analytics Dashboard",
    description: "Weekly/monthly progress, knowledge gap heatmaps, benchmarks, and exportable reports.",
  },
  {
    icon: Users,
    title: "Collaborative Learning",
    description: "Study groups, shared roadmaps, real-time progress sync, and live group tutoring sessions.",
  },
]

const stats = [
  { label: "Roadmaps Generated", value: "10,000+" },
  { label: "Active Learners", value: "5,000+" },
  { label: "Quiz Questions", value: "50,000+" },
  { label: "Study Hours", value: "100,000+" },
]

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#080d1c] text-white">
      <div className="pointer-events-none absolute -left-48 top-24 h-[32rem] w-[32rem] rounded-full bg-[#7C5CFC]/20 blur-3xl" />
      <div className="pointer-events-none absolute right-[-12rem] top-[-8rem] h-[38rem] w-[38rem] rounded-full bg-[#55D6FF]/15 blur-3xl" />
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080d1c]/75 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Logo href="/" />
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm font-medium text-slate-400 transition hover:text-white">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm font-medium text-slate-400 transition hover:text-white">
              How It Works
            </Link>
            <Link href="#stats" className="text-sm font-medium text-slate-400 transition hover:text-white">
              Stats
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="rounded-full bg-white text-[#080d1c] hover:bg-[#55D6FF]">Get Started Free</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative flex flex-1 items-center px-4 py-24 sm:py-32">
        <div className="container relative mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.05fr_.95fr]">
          <div className="animate-reveal">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#55D6FF]/25 bg-[#55D6FF]/10 px-4 py-2 text-sm font-medium text-[#55D6FF]">
            <Sparkles className="h-4 w-4" />
            <span>Your unfair advantage for learning</span>
          </div>
          <h1 className="mb-6 text-5xl font-semibold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl">
            Learn with a path that
            <span className="block bg-gradient-to-r from-[#7C5CFC] via-[#55D6FF] to-white bg-clip-text text-transparent">adapts to you.</span>
          </h1>
          <p className="mb-8 max-w-xl text-lg leading-8 text-slate-400 sm:text-xl">
            HiPath AI creates personalized learning paths that adapt to your progress.
            Identify weaknesses, practice with smart quizzes, and get 24/7 AI tutoring — all in one free platform.
          </p>
          <div className="mb-10 flex flex-col items-start gap-4 sm:flex-row">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2 rounded-full bg-gradient-to-r from-[#7C5CFC] to-[#55D6FF] px-7 font-semibold text-[#080d1c] hover:opacity-90">
                Start Learning Free
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button size="lg" variant="outline" className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10">See How It Works</Button>
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Privacy First</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>No Lock-in</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>Export Anytime</span>
            </div>
          </div>
          </div>
          <div className="relative animate-float">
            <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-[#7C5CFC]/30 to-[#55D6FF]/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.07] p-4 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 px-3 pb-4">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#55D6FF]" /><span className="text-sm text-slate-300">Your learning cockpit</span></div>
                <span className="text-xs text-[#55D6FF]">LIVE ADAPTATION</span>
              </div>
              <div className="grid gap-3 p-3 sm:grid-cols-[1.15fr_.85fr]">
                <div className="rounded-2xl bg-[#101828] p-5">
                  <div className="mb-8 flex items-center justify-between"><span className="text-sm text-slate-400">Frontend mastery</span><span className="text-2xl font-semibold">68%</span></div>
                  <div className="mb-6 h-2 rounded-full bg-white/10"><div className="h-full w-[68%] rounded-full bg-gradient-to-r from-[#7C5CFC] to-[#55D6FF]" /></div>
                  <div className="space-y-3">{["React patterns", "Async JavaScript", "System design"].map((item, i) => <div key={item} className="flex items-center justify-between rounded-xl bg-white/[0.04] p-3 text-sm"><span className="text-slate-300">{item}</span><span className={i === 1 ? "text-[#55D6FF]" : "text-slate-500"}>{i === 1 ? "Focus now" : "On track"}</span></div>)}</div>
                </div>
                <div className="space-y-3"><div className="rounded-2xl bg-gradient-to-br from-[#7C5CFC] to-[#42308f] p-5"><Sparkles className="mb-8 h-5 w-5" /><p className="text-sm text-white/70">Next best lesson</p><p className="mt-2 text-xl font-semibold">Async patterns in React</p><span className="mt-5 inline-block rounded-full bg-white/15 px-3 py-1 text-xs">18 min · Interactive</span></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-sm text-slate-400">Weekly streak</p><p className="mt-2 text-3xl font-semibold">7 days <span className="text-base text-[#55D6FF]">↗</span></p></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="border-y border-white/10 bg-white/[0.03] px-4 py-20">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((stat) => (
              <div key={stat.label}>
                  <div className="text-3xl font-semibold text-[#55D6FF] md:text-4xl">{stat.value}</div>
                  <div className="text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 py-24">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="mb-4 text-3xl font-semibold md:text-5xl">Everything you need to go further.</h2>
            <p className="mx-auto max-w-2xl text-lg text-slate-400">
              Built for professionals upskilling and self-learners. Every feature designed to help you learn faster and retain more.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="h-full border-white/10 bg-white/[0.04] text-white interactive-lift animate-reveal backdrop-blur">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7C5CFC]/25 to-[#55D6FF]/20">
                  <feature.icon className="h-6 w-6 text-[#55D6FF]" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-y border-white/10 bg-white/[0.03] px-4 py-24">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="mb-4 text-3xl font-semibold md:text-5xl">Get started in three steps.</h2>
            <p className="mx-auto max-w-2xl text-lg text-slate-400">
              From signup to your first personalized roadmap in minutes.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Answer 6 Questions",
                description: "Tell us your role, goals, skill level, pace, preferred format, and topics. Takes 2 minutes.",
              },
              {
                step: "02",
                title: "Get Your Roadmap",
                description: "AI generates a complete roadmap with phases, modules, lessons, and quizzes tailored to you.",
              },
              {
                step: "03",
                title: "Learn & Adapt",
                description: "Take lessons, complete quizzes, chat with your AI tutor. Your roadmap adapts as you grow.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center animate-reveal interactive-lift rounded-2xl p-4">
                <div className="mb-4 text-4xl font-semibold text-[#55D6FF]/40">{item.step}</div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-slate-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-24">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-semibold md:text-5xl">Ready to find your next level?</h2>
          <p className="mb-8 text-lg text-slate-400">
            Join thousands of learners who are mastering new skills with HiPath AI. Free forever.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="gap-2 rounded-full bg-gradient-to-r from-[#7C5CFC] to-[#55D6FF] px-7 font-semibold text-[#080d1c] hover:opacity-90">
              Create Free Account
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/10 px-4 py-12">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div id="about">
              <Logo compact />
              <p className="text-sm text-slate-500">
                Adaptive learning platform for professionals and self-learners. 
                Generate personalized roadmaps, detect weaknesses, and master skills faster.
              </p>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Product</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><Link href="/#features" className="hover:text-foreground">Roadmap Generator</Link></li>
                <li><Link href="/#features" className="hover:text-foreground">Weakness Detection</Link></li>
                <li><Link href="/#features" className="hover:text-foreground">Smart Quizzes</Link></li>
                <li><Link href="/#features" className="hover:text-foreground">AI Tutor</Link></li>
                <li><Link href="/#features" className="hover:text-foreground">Analytics</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Company</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><Link href="/#about" className="hover:text-foreground">About</Link></li>
                <li><Link href="/#features" className="hover:text-foreground">Blog</Link></li>
                <li><Link href="/#how-it-works" className="hover:text-foreground">Careers</Link></li>
                <li><a href="mailto:hello@hipathai.me" className="hover:text-foreground">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground">Terms of Service</Link></li>
                <li><Link href="/cookies" className="hover:text-foreground">Cookie Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              © 2026 HiPath AI. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="https://github.com/nullpeak03/hipathai" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">GitHub</a>
              <a href="https://x.com/hipathai" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">Twitter</a>
              <a href="mailto:hello@hipathai.me" className="text-muted-foreground hover:text-foreground">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}