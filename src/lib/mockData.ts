export type QuizDifficulty = "easy" | "medium" | "hard"
export type QuizQuestion = {
  q: string
  options: string[]
  correct: number
  explanation: string
  difficulty?: QuizDifficulty
}

import type { LessonContent } from "./lesson-content-blocks"

export type Lesson = {
  id: string
  idx: number
  title: string
  phaseIdx: number
  contentMd: string
  exampleCode: string
  /** Validated block document (migration 008). Null = render contentMd. */
  contentJson?: LessonContent | null
  quiz: QuizQuestion[]
  quizBank?: QuizQuestion[] | null
  estimatedMinutes?: number | null
  isLocked: boolean
  isCompleted: boolean
  /** Optional DAG prerequisite lesson IDs; when present, all must be passed to unlock. */
  prerequisites?: string[]
}
export type Phase = { id: string; idx: number; title: string; lessons: Lesson[] }

// Raw AI-generated shapes (before IDs are assigned)
export type LessonSpec = {
  title: string
  objective?: string
  quiz?: QuizQuestion[]
  exampleCode?: string
}
export type PhaseSpec = { title: string; lessons?: LessonSpec[] }
export type RoadmapSpec = {
  title: string
  description?: string
  goal?: string
  phases?: PhaseSpec[]
  totalLessons?: number
}

// Deprecated: All hardcoded roadmaps removed for fresh/new. Use Supabase + NIMs via /api/roadmaps.
// Kept only for type reference — do not use in UI.
export function generateMockRoadmap(): never {
  throw new Error("generateMockRoadmap removed — use Supabase + NIMs. See src/app/api/roadmaps")
}
