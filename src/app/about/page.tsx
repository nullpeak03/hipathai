import Link from "next/link"
import type { Metadata } from "next"

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
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="h-14 border-b flex items-center px-6 max-w-4xl mx-auto w-full justify-between">
        <Link href="/" className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">H</div><span className="font-bold">HiPath AI</span></Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Back to home</Link>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold">About HiPath AI</h1>
        <p className="text-muted-foreground mt-3 leading-relaxed">
          HiPath AI is a free AI learning navigator for computer science and technology. Tell it
          your goal — Python, JavaScript, AI agents, data structures — and it builds a week-by-week
          roadmap, teaches every lesson with runnable examples, verifies mastery with adaptive
          quizzes, and keeps you consistent with streaks and spaced reviews. A persistent AI tutor
          remembers your roadmap, your current lesson, and your weak areas.
        </p>
        <h2 className="text-xl font-semibold mt-10">How it works</h2>
        <ol className="mt-3 space-y-3 text-sm leading-relaxed list-decimal list-inside">
          <li><strong>Onboard in a minute:</strong> goal, level, daily time, and schedule.</li>
          <li><strong>Get your roadmap:</strong> AI generates phased, lesson-sized plans in the background.</li>
          <li><strong>Learn daily:</strong> structured lessons, then a quiz — score 60%+ to unlock the next lesson.</li>
          <li><strong>Stay consistent:</strong> streaks, XP, levels, and reminders keep momentum alive.</li>
        </ol>
        <h2 className="text-xl font-semibold mt-10">Under the hood</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Next.js with Clerk authentication and Supabase Postgres, background AI generation with
          NVIDIA models behind validated JSON contracts, installable PWA with offline access.
          AI output is validated, scored, and regenerated when it falls short — never served raw.
        </p>
        <h2 className="text-xl font-semibold mt-10">Start learning</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Browse the <Link href="/roadmaps" className="text-primary underline">free roadmap library</Link> or{" "}
          <Link href="/sign-up" className="text-primary underline">create your account</Link> — free, no credit card.
        </p>
      </main>
    </div>
  )
}
