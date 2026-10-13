import Link from "next/link"
import type { Metadata } from "next"
import { listGuides } from "@/lib/guides"

export const metadata: Metadata = {
  title: "Free Coding Guides — HiPath AI",
  description:
    "Practical guides for self-taught programmers: learning Python, escaping tutorial hell, DSA retention, AI agents, and daily study systems.",
  alternates: { canonical: "https://www.hipathai.me/guides" },
}

export default function GuidesIndex() {
  const guides = listGuides()
  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b flex items-center px-6 max-w-4xl mx-auto w-full justify-between">
        <Link href="/" className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">H</div><span className="font-bold">HiPath AI</span></Link>
        <Link href="/roadmaps" className="text-sm text-muted-foreground hover:text-foreground">Roadmap library</Link>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="t-display">Guides that actually teach</h1>
        <p className="text-muted-foreground mt-3 leading-relaxed">
          No fluff, no listicles — working systems for learning to code, each paired with
          a free week-by-week roadmap to go deeper.
        </p>
        <div className="mt-8 space-y-4">
          {guides.map((g) => (
            <Link key={g.slug} href={`/guides/${g.slug}`} className="block rounded-2xl border border-border bg-card p-6 card-lift">
              <div className="text-xs text-muted-foreground">{g.date} · {g.minutes} min read</div>
              <h2 className="font-semibold text-lg mt-1">{g.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{g.description}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {g.topics.map((t) => (
                  <span key={t} className="text-[11px] text-muted-foreground bg-muted border border-border rounded-full px-2.5 py-1">{t}</span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
