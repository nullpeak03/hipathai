import type { RoadmapData } from "./store"
import type { QuizQuestion } from "./mockData"

// Raw Supabase row shapes for the roadmap tree. Shared by the status API
// route (service-role client) and store.loadRoadmapAsync (browser client)
// so both build byte-identical RoadmapData from the same tables.

export type RoadmapRow = {
  id: string
  title: string
  description: string | null
  lessons_total: number | null
}

export type PhaseRow = { id: string; idx: number; title: string }

export type LessonRow = {
  id: string
  phase_id: string
  idx: number
  title: string
  content_md: string | null
  example_code: string | null
  quiz: QuizQuestion[] | null
}

export function toRoadmapData(roadmap: RoadmapRow, phases: PhaseRow[], lessons: LessonRow[]): RoadmapData {
  return {
    id: roadmap.id,
    title: roadmap.title,
    description: roadmap.description ?? "",
    totalLessons: roadmap.lessons_total ?? lessons.length,
    phases: phases.map((p) => ({
      id: p.id,
      idx: p.idx,
      title: p.title,
      lessons: lessons
        .filter((l) => l.phase_id === p.id)
        .map((l) => ({
          id: l.id,
          idx: l.idx,
          phaseIdx: p.idx,
          title: l.title,
          contentMd: l.content_md ?? "",
          exampleCode: l.example_code ?? "",
          quiz: l.quiz ?? [],
          isLocked: false,
          isCompleted: false,
        })),
    })),
  }
}
