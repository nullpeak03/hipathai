import Link from "next/link"
import type { Metadata } from "next"
import { createServerClient } from "@/lib/supabase/server"
import { countSyllabusLessons, isValidSyllabus, type PublicRoadmap } from "@/lib/public-roadmaps"

export const metadata: Metadata = {
  title: "Free Coding Roadmap Library",
  description:
    "Browse free week-by-week coding roadmaps — Python, JavaScript, DSA, AI agents, machine learning and more. Start any roadmap free with HiPath AI.",
  alternates: { canonical: "https://www.hipathai.me/roadmaps" },
}

export const revalidate = 86400

async function loadLibrary(): Promise<PublicRoadmap[]> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from("public_roadmaps")
      .select("id,slug,title,description,goal,level,syllabus,clones_count,published_at")
      .order("published_at", { ascending: false })
      .limit(100)
    return ((data ?? []) as PublicRoadmap[]).filter((r) => isValidSyllabus(r.syllabus))
  } catch {
    // Pre-migration builds render an empty library instead of failing.
    return []
  }
}

export default async function RoadmapLibrary() {
  const items = await loadLibrary()
  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b flex items-center px-6 max-w-5xl mx-auto w-full justify-between">
        <Link href="/" className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">H</div><span className="font-bold">HiPath AI</span></Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Back to home</Link>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold">Free Coding Roadmap Library</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Week-by-week syllabi for the most-searched programming goals. Open any roadmap to see
          every phase and lesson — then start it free and learn with an AI tutor, quizzes, and streaks.
        </p>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-10">
            New roadmaps are published here every week. <Link href="/sign-up" className="text-primary underline">Create yours →</Link>
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4 mt-8">
            {items.map((r) => {
              const lessons = countSyllabusLessons(r.syllabus)
              return (
                <Link key={r.slug} href={`/roadmaps/${r.slug}`} className="rounded-2xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-lg transition-all">
                  <div className="text-xs text-muted-foreground">{r.level} · {r.syllabus.phases.length} phases · {lessons} lessons</div>
                  <h2 className="font-semibold text-lg mt-1">{r.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
                  <span className="text-sm text-primary mt-3 inline-block">View syllabus →</span>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
