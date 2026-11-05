import Link from "next/link"
import type { Metadata } from "next"
import { Check } from "lucide-react"

export const metadata: Metadata = {
  title: "Product Roadmap — Where HiPath AI Is Going",
  description:
    "HiPath AI roadmap: adaptive roadmaps, AI lessons, code editor, mastery tracking, tutor, analytics, offline sync, badges, classrooms, and Nepali support.",
  alternates: { canonical: "https://www.hipathai.me/product-roadmap" },
}

const COLUMNS: { title: string; badge: string; items: { title: string; desc: string }[] }[] = [
  {
    title: "Shipped",
    badge: "✓ Live",
    items: [
      { title: "Adaptive roadmaps", desc: "Goal, level, and schedule become phased plans with exams and a final capstone." },
      { title: "AI lessons + quizzes", desc: "Teach, Example, Practice, Quiz — with model-sized banks and fresh retakes." },
      { title: "Runnable code in lessons", desc: "Edit and run examples inline with stdin, output, and error-line jumps." },
      { title: "IDE-lite code editor", desc: "Multi-file projects, tabs, file tree, local autosave, run, and export across 18 languages." },
      { title: "Persistent AI tutor", desc: "Roadmap-aware mentor with lesson position, direct or Socratic modes, and quiz help." },
      { title: "Mastery tracking", desc: "Per-lesson and per-topic mastery, a skill graph, and weak-skill recovery." },
      { title: "Learning analytics", desc: "Streaks, XP, levels, study heatmap, and community benchmarks." },
      { title: "Spaced review + reminders", desc: "Review queue for lessons that need another pass, plus optional email reminders." },
      { title: "Capstone evidence", desc: "Private project links, a completion checklist, and AI feedback on your capstone." },
      { title: "Roadmap library + guides", desc: "Free public syllabi and practical guides that feed into your path." },
      { title: "Installable PWA + offline shell", desc: "Add HiPath to your device and read cached lessons offline." },
      { title: "Accessibility + data controls", desc: "Reduced motion, high contrast, font size, plus JSON export and account deletion." },
    ],
  },
  {
    title: "Up next",
    badge: "In progress",
    items: [
      { title: "Offline sync queue", desc: "Quiz attempts and progress sync automatically when you reconnect." },
      { title: "Achievement badges", desc: "Milestones for passes, streaks, and XP levels." },
      { title: "Cloud code projects", desc: "Sync editor projects across devices and keep a project history." },
      { title: "AI code assist", desc: "Explain a selection, fix the last error, and generate test cases." },
      { title: "Nepali language", desc: "Full UI and tutor support in Nepali." },
    ],
  },
  {
    title: "Later",
    badge: "Planned",
    items: [
      { title: "Classrooms", desc: "Teachers assign roadmaps and track cohorts." },
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
  description: "Shipped features, what ships next, and long-term plans for HiPath AI.",
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
                <span className="text-[11px] font-medium text-info-fg bg-info-bg border border-info-border rounded-full px-2 py-0.5 inline-flex items-center gap-1">{col.badge === "✓ Live" ? <><Check className="w-3 h-3" /> Live</> : col.badge}</span>
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
          <p className="text-sm text-muted-foreground">HiPath AI is live — come learn with us.</p>
          <Link href="/sign-up" className="inline-flex mt-4 h-11 px-6 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-medium">Get Started Free →</Link>
        </div>
      </main>
    </div>
  )
}
