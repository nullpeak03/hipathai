import Link from "next/link"
import type { Metadata } from "next"
import { ArrowRight, Check } from "lucide-react"
import { MarketingContainer, MarketingShell } from "@/components/marketing/marketing-shell"
import { pageMetadata } from "@/lib/metadata"

export const metadata: Metadata = pageMetadata({
  title: "Changelog — What Shipped at HiPath AI",
  description:
    "Every HiPath AI release: the IDE-lite code editor, adaptive roadmaps, AI lessons, smart quizzes, mastery tracking, tutor upgrades, PWA install, and more.",
  path: "/changelog",
})

type Release = {
  label: string
  date: string
  tag: string
  summary: string
  items: string[]
}

const RELEASES: Release[] = [
  {
    label: "Code editor update",
    date: "November 2026",
    tag: "Editor",
    summary: "A full IDE-lite workspace inside lessons, quizzes, and the standalone editor.",
    items: [
      "New IDE-lite code editor with multi-file projects, tabs, a collapsible file tree, and per-file undo history.",
      "18 supported languages: Python, JavaScript, TypeScript, Java, C, C++, Go, Rust, Ruby, PHP, SQL, Swift, Bash, Lua, C#, Kotlin, Dart, and R.",
      "Local autosave, project switching, editor settings, and one-click export of the active file.",
      "Run the active file with stdin answers, stdout/stderr output, run history, and jump-to-error-line.",
      "C# and R execution added; Kotlin and Dart stay editable and exportable while marked editor-only.",
      "Lesson and quiz code blocks now share the upgraded editor, including a compact lesson layout.",
    ],
  },
  {
    label: "Mastery update",
    date: "October 2026",
    tag: "Learning",
    summary: "Mastery became its own signal, separate from lesson progression.",
    items: [
      "Mastery tracking per lesson and topic, separate from progression gates.",
      "Skill mastery graph and collapsible roadmap sections.",
      "Manual roadmap review queue before public publishing.",
      "Adaptive pacing, phase-based labels, and final capstone enforcement.",
      "Private capstone evidence with project links, a checklist, and AI feedback.",
      "Expanded settings for learning and accessibility preferences.",
      "Tutor mode switch and larger multi-line composer.",
    ],
  },
  {
    label: "v1.0.0",
    date: "September 26, 2026",
    tag: "Release",
    summary: "First production release — live with real learners.",
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
    label: "Launch month",
    date: "September 2026",
    tag: "Platform",
    summary: "The groundwork: library, AI routing, reliability, and auth routing.",
    items: [
      "Public roadmap library with auto-publish for new topics.",
      "AI routing with same-provider fallbacks and retries.",
      "Reliability: shared rate limits, failure email alerts, stale-job sweeper.",
      "Auth routing: returning users land on their dashboard.",
      "UI upgrade: design-system consistency, 44px touch targets, ambient theme.",
    ],
  },
]

function releaseId(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

export default function Changelog() {
  return (
    <MarketingShell>
      <MarketingContainer width="prose">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Changelog</p>
          <h1 className="t-display mt-2">Everything we ship, in the open.</h1>
          <p className="mt-3 text-muted-foreground">
            Newest first. Every meaningful change to HiPath AI — features, fixes, and the work behind them.
          </p>
        </div>

        <nav aria-label="Releases" className="mt-6 flex flex-wrap gap-2">
          {RELEASES.map((release) => (
            <a
              key={release.label}
              href={`#${releaseId(release.label)}`}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {release.label}
            </a>
          ))}
        </nav>

        <div className="relative mt-10">
          <div className="absolute bottom-0 left-[7px] top-2 hidden w-px bg-border sm:block" aria-hidden="true" />
          <div className="space-y-8">
            {RELEASES.map((release) => (
              <article key={release.label} id={releaseId(release.label)} className="relative scroll-mt-24 sm:pl-9">
                <span
                  className="absolute left-0 top-6 hidden h-3.5 w-3.5 rounded-full border-2 border-primary bg-background sm:block"
                  aria-hidden="true"
                />
                <div className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 className="text-xl font-semibold">{release.label}</h2>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                      {release.tag}
                    </span>
                    <time className="text-xs text-muted-foreground">{release.date}</time>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{release.summary}</p>
                  <ul className="mt-4 space-y-2 text-sm leading-relaxed">
                    {release.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-12 rounded-3xl border border-border bg-card p-8 text-center">
          <h2 className="text-xl font-bold">Try what shipped</h2>
          <p className="mt-2 text-sm text-muted-foreground">Free, no credit card.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground"
            >
              Get Started Free <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/product-roadmap"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-6 text-sm font-medium hover:bg-muted"
            >
              See what&apos;s next
            </Link>
          </div>
        </div>
      </MarketingContainer>
    </MarketingShell>
  )
}
