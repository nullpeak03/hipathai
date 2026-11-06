import type { Metadata } from "next"
import { createServerClient } from "@/lib/supabase/server"
import { countSyllabusLessons, isValidSyllabus, type PublicRoadmap } from "@/lib/public-roadmaps"
import { pageMetadata } from "@/lib/metadata"
import { MarketingContainer, MarketingShell } from "@/components/marketing/marketing-shell"
import { RoadmapLibrary, type LibraryItem } from "@/components/roadmaps/roadmap-library"

export const metadata: Metadata = pageMetadata({
  title: "Free Coding Roadmap Library",
  description:
    "Browse free week-by-week coding roadmaps — Python, JavaScript, DSA, AI agents, machine learning and more. Start any roadmap free with HiPath AI.",
  path: "/roadmaps",
})

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

export default async function RoadmapLibraryPage() {
  const roadmaps = await loadLibrary()
  const items: LibraryItem[] = roadmaps.map((roadmap) => ({
    slug: roadmap.slug,
    title: roadmap.title,
    description: roadmap.description,
    level: roadmap.level,
    phases: roadmap.syllabus.phases.length,
    lessons: countSyllabusLessons(roadmap.syllabus),
    phasePreview: roadmap.syllabus.phases.slice(0, 3).map((phase) => phase.title),
  }))

  return (
    <MarketingShell>
      <MarketingContainer width="default">
        <div className="max-w-2xl">
          <p className="t-caption font-mono uppercase tracking-wide text-primary">Roadmap library</p>
          <h1 className="t-display mt-2">Free Coding Roadmap Library</h1>
          <p className="mt-3 text-muted-foreground">
            Week-by-week syllabi for the most-searched programming goals. Open any roadmap to see
            every phase and lesson — then start it free with an AI tutor, quizzes, and streaks.
          </p>
        </div>
        <RoadmapLibrary items={items} />
      </MarketingContainer>
    </MarketingShell>
  )
}
