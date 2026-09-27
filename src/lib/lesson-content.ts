import { LESSON_JSON_CONTRACT } from "./lesson-content-blocks"

// Lesson content generation (Extended ~10-minute in-depth read, shaped by
// learner level). Roadmap scaffolding seeds lessons with a one-line
// objective; this builds the full lesson on demand, personalized to the
// learner's level + style from onboarding.

// Seeded stubs are short ("## Title\n\n<objective>"); generated lessons run
// several KB. Anything below this is treated as ungenerated.
export const REAL_CONTENT_MIN_CHARS = 600

export function needsRealContent(contentMd: string | null | undefined): boolean {
  if (!contentMd) return true
  return contentMd.trim().length < REAL_CONTENT_MIN_CHARS
}

export type LessonStyle = "Visual" | "Hands-on" | "Theory" | "Mixed"

const STYLE_GUIDANCE: Record<string, string> = {
  Visual: "Use vivid real-world analogies and simple text diagrams where they clarify. ",
  "Hands-on": "Include 2-3 mini-exercises with answers at the end. ",
  Theory: "Go deeper on first principles, precise terminology, and why things work. ",
  Mixed: "Balance explanation, one concrete example, and one quick check. ",
  "Project-Based": "Frame the lesson around building: end with a concrete implementation step. ",
  Socratic: "Close with probing questions that check articulation, not just recall. ",
  "Reading & Research": "Point at key terms to look up in official docs. ",
}

export type LessonPromptInput = {
  title: string
  objective: string
  level?: string
  style?: string | string[]
  goal?: string
}

/** Blend one or more styles (comma-joined or array); unknown tokens skipped. */
function lessonStyleGuidance(style: string | string[] | undefined): string {
  const tokens = (Array.isArray(style) ? style : (style ?? "Mixed").split(","))
    .map((s) => s.trim())
    .filter(Boolean)
  const seen = new Set<string>()
  const parts: string[] = []
  for (const token of tokens) {
    const guidance = STYLE_GUIDANCE[token]
    if (guidance && !seen.has(token)) {
      seen.add(token)
      parts.push(guidance.trim())
    }
  }
  if (parts.length === 0) parts.push(STYLE_GUIDANCE.Mixed.trim())
  return parts.join(" ") + " "
}

export const LESSON_EXAMPLE_MARKER = "---EXAMPLE---"

export function buildLessonPrompt({ title, objective, level = "Beginner", style = "Mixed", goal = "" }: LessonPromptInput): string {
  const levelGuidance =
    level === "Advanced"
      ? "Assume strong fundamentals. Be terse, cover edge cases and trade-offs. "
      : level === "Intermediate"
        ? "Assume basic familiarity. Define advanced jargon on first use. "
        : "Assume no prior knowledge. Define every piece of jargon in plain words. "
  return `Write a Standard (~5-minute read) lesson titled "${title}"${goal ? ` for a learner whose goal is "${goal}"` : ""}. Starting point: ${objective || "the lesson title"}. ${levelGuidance}${lessonStyleGuidance(style)}Structure: 1) What you will learn (2-3 bullets). 2) Concept explanation with one concrete example. 3) Common mistakes (2-3). 4) Key takeaways (3 bullets). Plain text, no markdown headings (use CAPS labels like WHAT YOU WILL LEARN:), no markdown fences in the prose. Then on its own line write exactly ${LESSON_EXAMPLE_MARKER}, then one line with the code language, then a complete runnable code example for the lesson (no fences). Return ONLY the lesson text, nothing else.`
}

/**
 * JSON variant: same calibration, but the model returns a validated block
 * document (see LESSON_JSON_CONTRACT) instead of prose. Preferred path —
 * the worker falls back to buildLessonPrompt + splitLessonContent output.
 */
export function buildLessonJsonPrompt({ title, objective, level = "Beginner", style = "Mixed", goal = "" }: LessonPromptInput): string {
  const levelGuidance =
    level === "Advanced"
      ? "Assume strong fundamentals. Go deep fast: internals, edge cases, performance trade-offs, and when NOT to use this. No hand-holding, no beginner analogies. "
      : level === "Intermediate"
        ? "Assume basic familiarity. Define advanced jargon once on first use, then go deeper: trade-offs, common production pitfalls, and how this connects to bigger systems. "
        : "Assume no prior knowledge. Scaffold generously: define every piece of jargon in plain words, use one vivid real-world analogy, build understanding in small steps with a runnable example after each idea. "
  return `Write an Extended (~10-minute read) in-depth lesson titled "${title}"${goal ? ` for a learner whose goal is "${goal}"` : ""}. Starting point: ${objective || "the lesson title"}. ${levelGuidance}${lessonStyleGuidance(style)}Cover in depth: learning objectives; concept explanation spanning what it is, WHY it works that way, and when NOT to use it; 2-3 graduated runnable code examples (basic first, then applied) each in its own {"type":"code"} block; one concrete real-world use case; 3-4 common mistakes with fixes; 3-4 exercises with solutions; key takeaways. Put EVERY code sample in its own {"type":"code"} block with real line breaks and the correct language (e.g. python) — never write code inside paragraph, bullets, or exercise text, and never use markdown fences. Depth over brevity, but no filler: every section must teach something new. ${LESSON_JSON_CONTRACT}`
}

/** Split generated output into lesson body + example code. */
export function splitLessonContent(generated: string): { contentMd: string; exampleCode: string } | null {
  const idx = generated.indexOf(LESSON_EXAMPLE_MARKER)
  if (idx === -1) return null
  const contentMd = generated.slice(0, idx).trim()
  const rest = generated.slice(idx + LESSON_EXAMPLE_MARKER.length).trim().split("\n")
  rest.shift() // language line
  const exampleCode = rest.join("\n").trim()
  if (contentMd.length < REAL_CONTENT_MIN_CHARS || exampleCode.length < 10) return null
  return { contentMd, exampleCode }
}
