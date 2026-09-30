import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { countSyllabusLessons, isValidSyllabus, type PublicRoadmap } from "@/lib/public-roadmaps"

export const revalidate = 86400
export const dynamicParams = true

async function loadRow(slug: string): Promise<PublicRoadmap | null> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from("public_roadmaps")
      .select("id,slug,title,description,goal,level,syllabus,clones_count,published_at")
      .eq("slug", slug)
      .single()
    const row = (data ?? null) as PublicRoadmap | null
    return row && isValidSyllabus(row.syllabus) ? row : null
  } catch {
    return null
  }
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase.from("public_roadmaps").select("slug").limit(500)
    return ((data ?? []) as { slug: string }[]).map((r) => ({ slug: r.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const row = await loadRow(slug)
  if (!row) return { title: "Roadmap not found" }
  const lessons = countSyllabusLessons(row.syllabus)
  return {
    title: `${row.title} — Week-by-Week Roadmap`,
    description: `${row.description} (${row.syllabus.phases.length} phases, ${lessons} lessons, free).`,
    alternates: { canonical: `https://www.hipathai.me/roadmaps/${row.slug}` },
    openGraph: {
      title: `${row.title} — Free Week-by-Week Roadmap`,
      description: row.description,
      type: "article",
    },
  }
}

export default async function PublicRoadmapPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const row = await loadRow(slug)
  if (!row) notFound()
  const lessons = countSyllabusLessons(row.syllabus)
  const faq = row.syllabus.phases.slice(0, 4).map((p) => ({
    q: `What will I learn in ${p.title}?`,
    a: p.lessons.slice(0, 5).map((l) => l.title).join(", ") + (p.lessons.length > 5 ? ", and more." : "."),
  }))
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Course",
        name: row.title,
        description: row.description,
        url: `https://www.hipathai.me/roadmaps/${row.slug}`,
        provider: { "@type": "Organization", name: "HiPath AI", sameAs: "https://www.hipathai.me/" },
        hasCourseInstance: {
          "@type": "CourseInstance",
          courseMode: "online",
          courseWorkload: `${row.syllabus.phases.length} phases, ${lessons} lessons`,
        },
        isAccessibleForFree: true,
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://www.hipathai.me/" },
          { "@type": "ListItem", position: 2, name: "Roadmap Library", item: "https://www.hipathai.me/roadmaps" },
          { "@type": "ListItem", position: 3, name: row.title },
        ],
      },
    ],
  }
  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="h-14 border-b flex items-center px-6 max-w-4xl mx-auto w-full justify-between">
        <Link href="/" className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">H</div><span className="font-bold">HiPath AI</span></Link>
        <Link href="/roadmaps" className="text-sm text-muted-foreground hover:text-foreground">All roadmaps</Link>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <nav className="text-xs text-muted-foreground" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-foreground">Home</Link> · <Link href="/roadmaps" className="hover:text-foreground">Library</Link> · {row.title}
        </nav>
        <div className="text-xs text-muted-foreground mt-4">{row.level} · {row.syllabus.phases.length} phases · {lessons} lessons · Free</div>
        <h1 className="text-3xl font-bold mt-1">{row.title}</h1>
        <p className="text-muted-foreground mt-2">{row.description}</p>
        <Link
          href={`/start/${row.slug}`}
          className="inline-flex mt-6 h-12 px-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-medium"
        >
          Start This Roadmap Free →
        </Link>
        <div className="mt-10 space-y-8">
          {row.syllabus.phases.map((p, pi) => (
            <section key={pi}>
              <h2 className="text-xl font-semibold">Phase {pi + 1}: {p.title}</h2>
              <ol className="mt-3 space-y-3">
                {p.lessons.map((l, li) => (
                  <li key={li} className="rounded-xl border border-border bg-card p-4">
                    <div className="font-medium text-sm">{l.title}</div>
                    {l.objective && <p className="text-sm text-muted-foreground mt-1">{l.objective}</p>}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
        <div className="mt-12 rounded-2xl border border-border bg-card p-8 text-center">
          <h2 className="text-xl font-bold">Learn this with an AI mentor</h2>
          <p className="text-sm text-muted-foreground mt-2">Adaptive quizzes, weakness tracking, streaks — free.</p>
          <Link
            href={`/start/${row.slug}`}
            className="inline-flex mt-4 h-12 px-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-medium"
          >
            Start This Roadmap Free →
          </Link>
        </div>
      </main>
    </div>
  )
}
