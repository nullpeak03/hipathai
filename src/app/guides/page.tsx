import Link from "next/link"
import type { Metadata } from "next"
import { listGuides } from "@/lib/guides"
import { pageMetadata } from "@/lib/metadata"
import { MarketingContainer, MarketingShell } from "@/components/marketing/marketing-shell"

export const metadata: Metadata = pageMetadata({
  title: "Free Coding Guides",
  description:
    "Practical guides for self-taught programmers: learning Python, escaping tutorial hell, DSA retention, AI agents, and daily study systems.",
  path: "/guides",
})

export default function GuidesIndex() {
  const guides = listGuides()
  return (
    <MarketingShell>
      <MarketingContainer width="prose">
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
      </MarketingContainer>
    </MarketingShell>
  )
}
