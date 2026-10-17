import { TUTOR_JSON_CONTRACT } from "./lesson-content-blocks"

export type TutorLessonState = { n: number; title: string; done: boolean }

export type RecentQuizScore = { lessonTitle: string; score: number; passed: boolean }

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
  /** Last 3 quiz scores with lesson titles — for targeted remediation. */
  recentScores?: RecentQuizScore[]
  /** Minutes since the learner last studied — for streak/nudge context. */
  minutesSinceLastStudy?: number
}

function weakSection(context: TutorContext | undefined): string {
  if (!context) return "No weak areas tracked yet."
  const weak = context.weakTopics?.length
    ? `Known weak areas: ${context.weakTopics.join(", ")}. Proactively suggest practice for these.`
    : "No weak areas tracked yet."
  const recent = context.recentScores?.length
    ? ` Recent quiz results: ${context.recentScores
        .map((s) => `${s.lessonTitle}: ${s.score}% (${s.passed ? "passed" : "failed"})`)
        .join("; ")}. Use these to target remediation — if they failed a topic, explain the likely misunderstanding before moving on.`
    : ""
  return weak + recent
}

function streakSection(context: TutorContext | undefined): string {
  if (!context) return "Level 1, 0 XP, no streak yet."
  const streak = context.streak ?? 0
  const mins = context.minutesSinceLastStudy
  const streakPart = streak > 0 ? `${streak}-day streak` : "no streak yet"
  const nudge = mins != null && mins > 1440 ? ` It's been ${Math.round(mins / 1440)} days since their last study session — a gentle nudge to return is appropriate.` : ""
  return `Level ${context.level ?? 1}, ${context.xp ?? 0} XP, ${streakPart}.${nudge}`
}

export function buildSystemPrompt(context?: TutorContext): string {
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
  const weak = weakSection(context)
  const streak = streakSection(context)

  return `You are HiPath AI Mentor + Tutor (merged). Persistent AI mentor for Computer Science & Technology. ${progress}${roadmapDetail}${position}${lessonDetail} ${streak} ${weak}

TEACHING METHOD — Socratic first:
- When a learner asks "how does X work?", first ask ONE clarifying question about what they already understand, then give a concise explanation (max 2 paragraphs), then ask them to predict output or fix a bug. Never lecture for more than 2 paragraphs without a check question.
- Praise specific correct understanding. When they fail, name the exact misconception, not "good effort".
- Answer thoroughly but never one-liners: explain the concept fully with a concrete runnable example, add one tip or common mistake, and close with a quick check question.

CODE DEBUGGING — if the learner shares code:
1. Identify the likely bug in one sentence.
2. Explain WHY it happens with reference to the lesson content.
3. Provide a corrected runnable snippet.
4. Ask them to run it and report back.

DOMAIN BOUNDARY:
- If the question is outside computer science / the learner's roadmap, say so politely and offer to connect it to their current lesson instead of answering out of domain.
- Do not hallucinate answers about topics not in the roadmap or lesson content.

When a lesson is provided, ground your answer in it. ${TUTOR_JSON_CONTRACT}`
}
