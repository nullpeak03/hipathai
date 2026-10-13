import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { listGuides, loadGuide } from "@/lib/guides"
import { createServerClient } from "@/lib/supabase/server"

export const revalidate = 86400
export const dynamicParams = true

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    return listGuides().map((g) => ({ slug: g.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const guide = loadGuide(slug)
  if (!guide) return { title: "Guide not found" }
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `https://www.hipathai.me/guides/${guide.slug}` },
    openGraph: { title: guide.title, description: guide.description, type: "article" },
  }
}

function headingId(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

function textOf(node: React.ReactNode): string {
  if (typeof node === "string") return node
  if (typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join("")
  if (node && typeof node === "object" && "props" in (node as object)) {
    return textOf((node as { props: { children?: React.ReactNode } }).props.children)
  }
  return ""
}

async function relatedRoadmaps(slugs: string[]): Promise<{ slug: string; title: string }[]> {
  if (slugs.length === 0) return []
  try {
    const supabase = createServerClient()
    const { data } = await supabase.from("public_roadmaps").select("slug,title").in("slug", slugs)
    return ((data ?? []) as { slug: string; title: string }[]).filter((r) => slugs.includes(r.slug))
  } catch {
    return []
  }
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const guide = loadGuide(slug)
  if (!guide) notFound()
  const related = await relatedRoadmaps(guide.relatedSlugs)
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: guide.title,
        description: guide.description,
        datePublished: guide.date,
        author: { "@type": "Organization", name: "HiPath AI", url: "https://www.hipathai.me/" },
        mainEntityOfPage: `https://www.hipathai.me/guides/${guide.slug}`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://www.hipathai.me/" },
          { "@type": "ListItem", position: 2, name: "Guides", item: "https://www.hipathai.me/guides" },
          { "@type": "ListItem", position: 3, name: guide.title },
        ],
      },
    ],
  }
  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="h-14 border-b flex items-center px-6 max-w-4xl mx-auto w-full justify-between">
        <Link href="/" className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">H</div><span className="font-bold">HiPath AI</span></Link>
        <Link href="/guides" className="text-sm text-muted-foreground hover:text-foreground">All guides</Link>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <nav className="text-xs text-muted-foreground" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-foreground">Home</Link> · <Link href="/guides" className="hover:text-foreground">Guides</Link> · {guide.title}
        </nav>
        <div className="text-xs text-muted-foreground mt-4">{guide.date} · {guide.minutes} min read</div>
        <h1 className="t-display mt-1" style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)" }}>{guide.title}</h1>
        {guide.headings.length > 1 && (
          <nav className="mt-6 rounded-2xl border border-border bg-card p-5" aria-label="Table of contents">
            <div className="text-xs font-semibold text-muted-foreground mb-2">IN THIS GUIDE</div>
            <ul className="space-y-1.5">
              {guide.headings.map((h) => (
                <li key={h.id} className={h.level === 3 ? "ml-4" : ""}>
                  <a href={`#${h.id}`} className="text-sm text-primary underline underline-offset-4">{h.text}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="mt-8 space-y-4 text-[0.9375rem] leading-[1.7] [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mt-8 [&>h3]:font-semibold [&>h3]:mt-6 [&>p]:text-foreground/90 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1.5 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:space-y-1.5 [&>pre]:bg-zinc-900 [&>pre]:text-zinc-100 [&>pre]:p-4 [&>pre]:rounded-xl [&>pre]:overflow-x-auto [&>pre]:text-sm [&_code]:font-mono [&_code]:text-[0.9em] [&>p_code]:border [&>p_code]:bg-muted [&>p_code]:px-1.5 [&>p_code]:py-0.5 [&>p_code]:rounded-md [&>a]:text-primary [&>a]:underline [&>a]:underline-offset-4">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => <h2 id={headingId(textOf(children))}>{children}</h2>,
              h3: ({ children }) => <h3 id={headingId(textOf(children))}>{children}</h3>,
            }}
          >
            {guide.content}
          </ReactMarkdown>
        </div>
        {related.length > 0 && (
          <div className="mt-12 rounded-2xl border border-border bg-card p-6">
            <h2 className="font-semibold">Keep going with a full roadmap</h2>
            <div className="mt-3 space-y-2">
              {related.map((r) => (
                <Link key={r.slug} href={`/roadmaps/${r.slug}`} className="block text-sm text-primary underline underline-offset-4">
                  {r.title} →
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="mt-8 rounded-2xl bg-primary text-primary-foreground p-8 text-center">
          <h2 className="text-xl font-bold">Learn this with an AI mentor</h2>
          <p className="text-sm opacity-90 mt-2">Roadmaps, quizzes, streaks — free.</p>
          <Link href="/sign-up" className="inline-flex mt-4 h-11 px-6 items-center justify-center rounded-lg bg-white text-sm font-medium" style={{ color: "#2a1fb5" }}>
            Get Started Free →
          </Link>
        </div>
      </main>
    </div>
  )
}
