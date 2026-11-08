import Link from "next/link"
import type { Metadata } from "next"
import { LESSON_PASS_THRESHOLD } from "@/lib/v2-mastery"
import { FOUNDER } from "@/lib/founder"
import { MarketingContainer, MarketingShell } from "@/components/marketing/marketing-shell"

export const metadata: Metadata = {
  title: "About HiPath AI — Free AI Learning Roadmaps",
  description:
    "HiPath AI turns any computer science goal into a week-by-week roadmap with an AI tutor, adaptive quizzes, and streaks. Free, built for self-taught learners.",
  alternates: { canonical: "https://www.hipathai.me/about" },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "HiPath AI",
      url: "https://www.hipathai.me/",
      logo: "https://www.hipathai.me/icon.svg",
      sameAs: ["https://www.hipathai.me/"],
      founder: {
        "@type": "Person",
        name: FOUNDER.name,
        jobTitle: FOUNDER.role,
        description: FOUNDER.bio,
        url: FOUNDER.linkedin,
        sameAs: [FOUNDER.linkedin],
      },
    },
    {
      "@type": "WebSite",
      name: "HiPath AI",
      url: "https://www.hipathai.me/",
    },
  ],
}

export default function About() {
  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MarketingContainer width="prose">
        <h1 className="text-3xl font-bold">About HiPath AI</h1>
        <p className="text-muted-foreground mt-3 leading-relaxed">
          HiPath AI is a free AI learning navigator for computer science and technology. Tell it
          your goal — Python, JavaScript, AI agents, data structures — and it builds a week-by-week
          roadmap, teaches every lesson with runnable examples, verifies mastery with adaptive quizzes, tracks skill mastery per lesson and topic, and keeps you consistent with streaks and spaced reviews. An IDE-lite code editor lets you write and run real code across 18 languages, while a persistent AI tutor remembers your roadmap, your current lesson, and your weak areas.
        </p>
        <h2 className="text-xl font-semibold mt-10">How it works</h2>
        <ol className="mt-3 space-y-3 text-sm leading-relaxed list-decimal list-inside">
          <li><strong>Onboard in a minute:</strong> goal, level, daily time, and schedule.</li>
          <li><strong>Get your roadmap:</strong> AI generates phased, lesson-sized plans in the background.</li>
          <li><strong>Learn daily:</strong> structured lessons, then a quiz — score {LESSON_PASS_THRESHOLD}%+ to unlock the next lesson.</li>
          <li><strong>Stay consistent:</strong> streaks, XP, levels, and reminders keep momentum alive.</li>
        </ol>
        <h2 className="text-xl font-semibold mt-10">What you get</h2>
        <ul className="mt-3 grid gap-3 text-sm leading-relaxed sm:grid-cols-2">
          <li><strong>Adaptive roadmaps:</strong> phased, lesson-sized plans with phase exams and a final capstone.</li>
          <li><strong>AI lessons:</strong> Teach, Example, Practice, and Quiz steps with runnable code.</li>
          <li><strong>Smart quizzes:</strong> lesson-sized banks, a pass gate, and fresh questions on retake.</li>
          <li><strong>Code editor:</strong> multi-file projects, tabs, file tree, local autosave, stdin, output, run history, and export in 18 languages.</li>
          <li><strong>Persistent tutor:</strong> roadmap-aware help with direct or Socratic modes and quiz remediation.</li>
          <li><strong>Mastery + analytics:</strong> per-lesson and per-topic mastery, skill graph, streaks, XP, heatmap, and benchmarks.</li>
          <li><strong>Spaced review:</strong> resurface weak lessons with optional email reminders.</li>
          <li><strong>Capstone evidence:</strong> private project links, a completion checklist, and AI feedback.</li>
          <li><strong>Roadmap library + guides:</strong> free public syllabi and practical learning guides.</li>
          <li><strong>Offline PWA:</strong> install HiPath and keep cached lessons available offline.</li>
          <li><strong>Accessibility + data controls:</strong> reduced motion, high contrast, font size, JSON export, and account deletion.</li>
        </ul>
        <h2 className="text-xl font-semibold mt-10">Under the hood</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Next.js with Clerk authentication and Supabase Postgres, background AI generation with
          AI models behind validated JSON contracts, installable PWA with offline access.
          AI output is validated, scored, and regenerated when it falls short — never served raw.
        </p>
        <h2 className="text-xl font-semibold mt-10">Who builds HiPath</h2>
        <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center">
          <div
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground"
          >
            HA
          </div>
          <div className="min-w-0">
            <p className="font-semibold">{FOUNDER.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{FOUNDER.bio}</p>
            <a
              href={FOUNDER.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex text-sm font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
            >
              Connect on LinkedIn<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
        <h2 className="text-xl font-semibold mt-10">Start learning</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Browse the <Link href="/roadmaps" className="text-primary underline">free roadmap library</Link> or{" "}
          <Link href="/sign-up" className="text-primary underline">create your account</Link> — free, no credit card.
        </p>
      </MarketingContainer>
    </MarketingShell>
  )
}
