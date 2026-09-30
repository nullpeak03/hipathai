import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Product Roadmap — Where HiPath AI Is Going",
  description:
    "HiPath AI roadmap: shipped V1, upcoming offline sync, badges, guides, classrooms, and Nepali language support.",
  alternates: { canonical: "https://www.hipathai.me/product-roadmap" },
}

const COLUMNS: { title: string; badge: string; items: { title: string; desc: string }[] }[] = [
  {
    title: "Shipped (V1 live)",
    badge: "✓ Live",
    items: [
      { title: "Adaptive roadmaps", desc: "Week-by-week plans with concept titles and phase exams." },
      { title: "AI lessons + quizzes", desc: "Extended lessons, model-sized banks, fresh retakes." },
      { title: "Persistent tutor", desc: "Roadmap-aware mentor with lesson position." },
      { title: "PWA + offline shell", desc: "Installable app with cached lessons." },
    ],
  },
  {
    title: "Up next (V2)",
    badge: "In progress",
    items: [
      { title: "Offline sync queue", desc: "Quiz attempts and progress sync when reconnected." },
      { title: "Achievement badges", desc: "Milestones for passes, streaks, and XP levels." },
      { title: "Guides & blog", desc: "Free learning guides that feed the roadmap library." },
      { title: "Nepali language", desc: "Full UI and tutor support in Nepali." },
    ],
  },
  {
    title: "Later (V3)",
    badge: "Planned",
    items: [
      { title: "Classrooms", desc: "Teachers assign roadmaps, track cohorts." },
      { title: "Leaderboards", desc: "Friendly competition on XP and streaks." },
      { title: "Native apps", desc: "Store listings beyond the PWA." },
    ],
  },
]

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "HiPath AI Product Roadmap",
  url: "https://www.hipathai.me/product-roadmap",
  description: "Shipped features, upcoming V2 work, and long-term plans for HiPath AI.",
}

export default function ProductRoadmap() {
  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="h-14 border-b flex items-center px-6 max-w-5xl mx-auto w-full justify-between">
        <Link href="/" className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">H</div><span className="font-bold">HiPath AI</span></Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Back to home</Link>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold">Product Roadmap</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">Where HiPath AI has been, what ships next, and the long-term vision. Updated as we build.</p>
        <div className="grid md:grid-cols-3 gap-4 mt-8">
          {COLUMNS.map((col) => (
            <section key={col.title} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{col.title}</h2>
                <span className="text-[11px] font-medium text-info-fg bg-info-bg border border-info-border rounded-full px-2 py-0.5">{col.badge}</span>
              </div>
              <div className="mt-4 space-y-4">
                {col.items.map((item) => (
                  <div key={item.title}>
                    <div className="text-sm font-medium">{item.title}</div>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="mt-10 text-center">
          <p className="text-sm text-muted-foreground">V1 is live — come learn with us.</p>
          <Link href="/sign-up" className="inline-flex mt-4 h-11 px-6 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-medium">Get Started Free →</Link>
        </div>
      </main>
    </div>
  )
}
