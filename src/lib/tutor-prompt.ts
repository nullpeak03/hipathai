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
  lowMasteryTopics?: string[]
  lessonTitle?: string
  lessonContent?: string
  /** Last 3 quiz scores with lesson titles — for targeted remediation. */
  recentScores?: RecentQuizScore[]
  /** Minutes since the learner last studied — for streak/nudge context. */
  minutesSinceLastStudy?: number
  /** Image URLs attached to the current message (screenshots, diagrams). */
  imageUrls?: string[]
}

/** Compress roadmap phases to fit token budget — summarize to ≤500 chars. */
function compressRoadmapContext(phases?: TutorContext["phases"]): string {
  if (!phases?.length) return "No roadmap yet."
  const parts = phases.map((p) => {
    const done = p.lessons.filter((l) => l.done).length
    const total = p.lessons.length
    return `${p.title} (${done}/${total} done)`
  })
  return `Roadmap: ${parts.join(" → ")}.`
}

/** Few-shot exemplars for tutor JSON contract — teaches exact block structure. */
const TUTOR_EXEMPLAR = `
Example response for "Why does my closure capture the wrong value?":
{"sections":[
  {"type":"heading","text":"Closure Variable Capture"},
  {"type":"paragraph","text":"In JavaScript, closures capture variables by reference, not by value. When your loop creates functions, they all reference the SAME variable 'i', which ends up as the final value after the loop completes."},
  {"type":"code","language":"javascript","code":"// Problem: all functions log 3\nfor (var i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i), 100);\n}\n// Output: 3, 3, 3"},
  {"type":"callout","kind":"key","text":"Use 'let' (block-scoped) or IIFE to capture each iteration's value."},
  {"type":"code","language":"javascript","code":"// Fix 1: let creates new binding per iteration\nfor (let i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i), 100);\n}\n// Output: 0, 1, 2"},
  {"type":"check","prompt":"What does 'let' do differently from 'var' in a loop?","options":["Creates global variable","Creates block-scoped binding per iteration","Makes variable immutable","Prevents hoisting"],"correct":1,"explanation":"'let' creates a new binding for each loop iteration, so each closure captures its own value."},
  {"type":"resources","items":[{"label":"MDN let","url":"https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let"}]}
]}`

function weakSection(context: TutorContext | undefined): string {
  if (!context) return "No weak areas tracked yet."
  const weak = context.weakTopics?.length
    ? `Known weak areas: ${context.weakTopics.join(", ")}. Proactively suggest practice for these.`
    : "No weak areas tracked yet."
  const lowMastery = context.lowMasteryTopics?.length
    ? ` Low-mastery topics (below 90%): ${context.lowMasteryTopics.join(", ")}. Reinforce these before advancing.`
    : ""
  const recent = context.recentScores?.length
    ? ` Recent quiz results: ${context.recentScores
        .map((s) => `${s.lessonTitle}: ${s.score}% (${s.passed ? "passed" : "failed"})`)
        .join("; ")}. Use these to target remediation — if they failed a topic, explain the likely misunderstanding before moving on.`
    : ""
  return weak + lowMastery + recent
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
  // Compressed roadmap structure — fits token budget, still cites exact numbers
  const roadmapDetail = context?.phases?.length
    ? ` ${compressRoadmapContext(context.phases)} Current lesson numbers are exact — always cite them.`
    : ""
  const position = context?.currentLesson
    ? ` The learner's CURRENT lesson is #${context.currentLesson.n} "${context.currentLesson.title}" (first incomplete). When asked about next/previous lessons, answer from these numbers and flags — never guess.`
    : ""
  const lessonDetail = context?.lessonTitle
    ? ` Current lesson: "${context.lessonTitle}"${context.lessonContent ? ` — Key concepts: ${context.lessonContent.slice(0, 800)}` : ""}. You MUST reference this lesson by name and content when answering; do not give generic reasoning.`
    : ""
  const weak = weakSection(context)
  const streak = streakSection(context)

  const imageSection = context?.imageUrls?.length
    ? ` The learner has attached ${context.imageUrls.length} image(s) to this message. Analyze them carefully — if they show code errors, identify the bug, explain why it happens, and suggest a fix. If they show diagrams, describe what they illustrate and connect it to the lesson.`
    : ""

  return `You are HiPath AI Mentor + Tutor (merged). Persistent AI mentor for Computer Science & Technology. ${progress}${roadmapDetail}${position}${lessonDetail} ${streak} ${weak}${imageSection}

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

When a lesson is provided, ground your answer in it.

Few-shot exemplar (match this exact block structure and quality):
${TUTOR_EXEMPLAR}

${TUTOR_JSON_CONTRACT}`
}
