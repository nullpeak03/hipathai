export type Lesson = {
  id: string
  idx: number
  title: string
  phaseIdx: number
  contentMd: string
  exampleCode: string
  quiz: { q: string; options: string[]; correct: number; explanation: string }[]
  isLocked: boolean
  isCompleted: boolean
}
export type Phase = { id: string; idx: number; title: string; lessons: Lesson[] }

// Deprecated: All hardcoded roadmaps removed for fresh/new. Use Supabase + Nvidia NIMs via /api/roadmaps.
// Kept only for type reference — do not use in UI.
export function generateMockRoadmap(_goal: string): never {
  throw new Error("generateMockRoadmap removed — use Supabase + NIMs. See src/app/api/roadmaps")
}
