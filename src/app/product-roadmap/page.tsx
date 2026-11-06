import Link from "next/link"
import type { Metadata } from "next"
import { ArrowRight, Check, CircleDashed, Clock3 } from "lucide-react"
import { MarketingContainer, MarketingShell } from "@/components/marketing/marketing-shell"
import { pageMetadata } from "@/lib/metadata"

export const metadata: Metadata = pageMetadata({
  title: "Product Roadmap — Where HiPath AI Is Going",
  description:
    "What HiPath AI has shipped, what ships next, and the long-term vision: adaptive roadmaps, AI lessons, the code editor, mastery tracking, tutor, analytics, offline sync, badges, classrooms, and Nepali support.",
  path: "/product-roadmap",
})

type Item = { title: string; desc: string }

const SHIPPED: Item[] = [
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
]

const UP_NEXT: Item[] = [
  { title: "Offline sync queue", desc: "Quiz attempts and progress sync automatically when you reconnect." },
  { title: "Achievement badges", desc: "Milestones for passes, streaks, and XP levels." },
  { title: "Cloud code projects", desc: "Sync editor projects across devices and keep a project history." },
  { title: "AI code assist", desc: "Explain a selection, fix the last error, and generate test cases." },
  { title: "Nepali language", desc: "Full UI and tutor support in Nepali." },
]

const LATER: Item[] = [
  { title: "Classrooms", desc: "Teachers assign roadmaps and track cohorts." },
  { title: "Leaderboards", desc: "Friendly competition on XP and streaks." },
  { title: "Native apps", desc: "Store listings beyond the PWA." },
]

const SECTION_LINKS = [
  { href: "#shipped", label: "Shipped" },
  { href: "#up-next", label: "Up next" },
  { href: "#later", label: "Later" },
]

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "HiPath AI Product Roadmap",
  url: "https://www.hipathai.me/product-roadmap",
  description: "Shipped features, what ships next, and long-term plans for HiPath AI.",
}

function SectionHeading({ id, eyebrow, title, description }: { id: string; eyebrow: string; title: string; description: string }) {
  return (
    <div className="max-w-2xl">
      <div className="text-xs font-semibold uppercase tracking-wide text-primary">{eyebrow}</div>
      <h2 id={id} className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

export default function ProductRoadmap() {
  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MarketingContainer width="wide">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Product roadmap</p>
          <h1 className="t-display mt-2">Where HiPath AI is going.</h1>
          <p className="mt-4 text-muted-foreground">
            Where HiPath AI has been, what ships next, and the long-term vision. Updated as we build.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="rounded-full border border-border bg-card px-3 py-1">Last updated: November 2026</span>
            <span>{SHIPPED.length} shipped</span>
            <span aria-hidden="true">·</span>
            <span>{UP_NEXT.length} in progress</span>
            <span aria-hidden="true">·</span>
            <span>{LATER.length} planned</span>
          </div>
        </div>

        <nav aria-label="Roadmap sections" className="mt-8 flex flex-wrap gap-2">
          {SECTION_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <section className="mt-12 scroll-mt-24" aria-labelledby="shipped">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              id="shipped"
              eyebrow="Live today"
              title="Shipped"
              description="Everything below is available to every learner, free."
            />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--ok-border)] bg-[color:var(--ok-bg)] px-3 py-1 text-xs font-medium text-[color:var(--ok-fg)]">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> Live
            </span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SHIPPED.map((item) => (
              <article key={item.title} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--ok-fg)]" aria-hidden="true" />
                  <div>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-14 scroll-mt-24" aria-labelledby="up-next">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              id="up-next"
              eyebrow="In progress"
              title="Up next"
              description="Actively being built. Order can shift as we learn from learners."
            />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--warn-border)] bg-[color:var(--warn-bg)] px-3 py-1 text-xs font-medium text-[color:var(--warn-fg)]">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> Building
            </span>
          </div>
          <div className="mt-6 grid gap-3 rounded-2xl border border-border bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-5">
            {UP_NEXT.map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 scroll-mt-24" aria-labelledby="later">
          <SectionHeading
            id="later"
            eyebrow="Planned"
            title="Later"
            description="Long-term direction, not a delivery commitment."
          />
          <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
            {LATER.map((item) => (
              <div key={item.title} className="flex items-start gap-3 p-5">
                <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-14 rounded-3xl border border-border bg-card p-8 text-center">
          <h2 className="text-xl font-bold">HiPath AI is live — come learn with us.</h2>
          <p className="mt-2 text-sm text-muted-foreground">Free to start, no credit card.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground"
            >
              Get Started Free <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/roadmaps"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-6 text-sm font-medium hover:bg-muted"
            >
              Browse the library
            </Link>
          </div>
        </div>
      </MarketingContainer>
    </MarketingShell>
  )
}
