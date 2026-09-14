import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Sparkles, ArrowRight, CheckCircle2, BookOpen, Bot, Target } from "lucide-react"

export default function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col">
      <header className="h-16 border-b dark:border-zinc-800 flex items-center justify-between px-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-[#6C5BFF] flex items-center justify-center text-white font-bold">H</div><span className="font-bold">HiPath AI</span></div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-zinc-600 dark:text-zinc-400 hidden sm:block">Sign in</Link>
          <Link href="/onboarding"><Button>Get Started Free</Button></Link>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center">
        <div className="w-full max-w-7xl px-6 py-16 lg:py-24 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 text-xs bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 rounded-full px-3 py-1 text-violet-700 dark:text-violet-300 mb-6">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> AI-Powered Learning Platform
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl">
            Your Personal <span className="text-[#6C5BFF]">AI</span><br /> Learning Navigator
          </h1>
          <p className="mt-6 max-w-2xl text-zinc-600 dark:text-zinc-400 text-base sm:text-lg">
            HiPath AI builds you a personalized roadmap, guides you day by day with AI tutoring, adapts to your weaknesses, and keeps you motivated — like having a mentor in your pocket.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link href="/onboarding"><Button size="lg" className="gap-2">Start Learning Free <ArrowRight className="w-4 h-4" /></Button></Link>
            <a href="#features"><Button variant="outline" size="lg">Explore Features</Button></a>
          </div>
          <div className="mt-4 flex items-center gap-6 text-xs text-zinc-500">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> No credit card</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Free forever</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Cancel anytime</span>
          </div>

          <div id="features" className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl text-left">
            {[
              { icon: Target, title: "Adaptive Roadmaps", desc: "Any CS goal → structured phases, 40+ lessons, day-by-day guidance." },
              { icon: Bot, title: "Pocket Mentor", desc: "Persistent AI that teaches, quizzes, motivates & tracks weaknesses." },
              { icon: BookOpen, title: "Learn by Doing", desc: "Teach → Example → Practice → Quiz. Unlock next only when you pass." },
            ].map(f => (
              <div key={f.title} className="rounded-2xl border dark:border-zinc-800 p-6 bg-white dark:bg-zinc-900">
                <f.icon className="w-8 h-8 text-[#6C5BFF] mb-3" />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <footer className="border-t dark:border-zinc-800 py-6 text-center text-xs text-zinc-500">© 2026 HiPath AI — Computer Science & Technology focus</footer>
    </div>
  )
}
