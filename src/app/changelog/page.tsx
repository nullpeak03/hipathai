import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Changelog — What Shipped at HiPath AI",
  description:
    "Every HiPath AI release: adaptive roadmaps, AI lessons, smart quizzes, tutor upgrades, PWA install, and more.",
  alternates: { canonical: "https://www.hipathai.me/changelog" },
}

const RELEASES: { version: string; date: string; items: string[] }[] = [
  {
    version: "v1.0.0",
    date: "September 26, 2026",
    items: [
      "First production release — live with real learners.",
      "Adaptive roadmaps with image-style concept titles and phase exams.",
      "Extended AI lessons with real multi-line code blocks and level-adaptive depth.",
      "Model-sized quiz banks with delete-on-pass fresh retakes and code panels.",
      "Roadmap-aware tutor with explicit lesson position — never answers done lessons.",
      "Analytics dashboard with streaks, XP, heatmap, and benchmarks.",
      "Installable PWA with offline shell; SEO package with roadmap library.",
    ],
  },
  {
    version: "Launch month",
    date: "September 2026",
    items: [
      "Public roadmap library with auto-publish for new topics.",
      "NVIDIA-only AI routing with same-provider fallbacks and retries.",
      "Reliability: shared rate limits, failure email alerts, stale-job sweeper.",
      "Auth routing: returning users land on their dashboard.",
      "UI upgrade: design-system consistency, 44px touch targets, ambient theme.",
    ],
  },
]

export default function Changelog() {
  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b flex items-center px-6 max-w-4xl mx-auto w-full justify-between">
        <Link href="/" className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">H</div><span className="font-bold">HiPath AI</span></Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Back to home</Link>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold">Changelog</h1>
        <p className="text-muted-foreground mt-2">Everything we ship, in the open. Newest first.</p>
        <div className="mt-10 space-y-10">
          {RELEASES.map((r) => (
            <section key={r.version}>
              <div className="flex items-baseline gap-3">
                <h2 className="text-xl font-semibold">{r.version}</h2>
                <span className="text-xs text-muted-foreground">{r.date}</span>
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed">
                {r.items.map((item) => (
                  <li key={item} className="flex gap-2"><span className="text-primary">✓</span><span>{item}</span></li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="mt-12 rounded-2xl border border-border bg-card p-8 text-center">
          <h2 className="text-xl font-bold">Try what shipped</h2>
          <p className="text-sm text-muted-foreground mt-2">Free, no credit card.</p>
          <Link href="/sign-up" className="inline-flex mt-4 h-11 px-6 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-medium">Get Started Free →</Link>
        </div>
      </main>
    </div>
  )
}
