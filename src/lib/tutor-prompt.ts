import { TUTOR_JSON_CONTRACT } from "./lesson-content-blocks"

export type TutorLessonState = { n: number; title: string; done: boolean }

export type TutorContext = {
  roadmapTitle?: string
  /** Phases with globally numbered lessons + completion flags (source of truth). */
  phases?: { title: string; lessons: TutorLessonState[] }[]
  /** First incomplete lesson — the learner's actual current position. */
  currentLesson?: { n: number; title: string } | null
  level?: number
  xp?: number
  streak?: number
  lessonsDone?: number
  totalLessons?: number
  weakTopics?: string[]
  lessonTitle?: string
  lessonContent?: string
}

export function buildSystemPrompt(context?: TutorContext): string {
  const weak = context?.weakTopics?.length
    ? `Known weak areas: ${context.weakTopics.join(", ")}. Proactively suggest practice for these.`
    : "No weak areas tracked yet."
  const progress = context?.totalLessons
    ? `Progress: ${context.lessonsDone ?? 0}/${context.totalLessons} lessons on "${context.roadmapTitle}".`
    : `Roadmap: ${context?.roadmapTitle || "No roadmap yet"}.`
  // Numbered structure with completion marks — the model must use these exact
  // numbers and never invent its own ("Lesson 3" for a done lesson happened).
  const roadmapDetail = context?.phases?.length
    ? ` Roadmap structure (lesson numbers are exact — always cite them): ${context.phases.map((p) => `${p.title} [${p.lessons.map((l) => `#${l.n} ${l.title}${l.done ? " ✓done" : ""}`).join("; ")}]`).join(" | ")}.`
    : ""
  const position = context?.currentLesson
    ? ` The learner's CURRENT lesson is #${context.currentLesson.n} "${context.currentLesson.title}" (first incomplete). When asked about next/previous lessons, answer from these numbers and flags — never guess.`
    : ""
  const lessonDetail = context?.lessonTitle
    ? ` Current lesson: "${context.lessonTitle}"${context.lessonContent ? ` — Content: ${context.lessonContent.slice(0, 1500)}` : ""}. You MUST reference this lesson by name and content when answering; do not give generic reasoning.`
    : ""
  return `You are HiPath AI Mentor + Tutor (merged). Persistent AI mentor for Computer Science & Technology. ${progress}${roadmapDetail}${position}${lessonDetail} Level ${context?.level ?? 1}, ${context?.xp ?? 0} XP, ${context?.streak ?? 0}-day streak. ${weak} Be motivational and adapt explanations to the learner's level. Answer thoroughly: explain the concept fully with a concrete runnable example, add one tip or common mistake, and close with a quick check question — never one-liners. When a lesson is provided, ground your answer in it. ${TUTOR_JSON_CONTRACT}`
}
