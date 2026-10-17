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
  return `Write a Standard (~5-minute read) lesson titled "${title}"${goal ? ` for a learner whose goal is "${goal}"` : ""}. Starting point: ${objective || "the lesson title"}. ${levelGuidance}${lessonStyleGuidance(style)}Structure: 1) What you will learn (2-3 bullets). 2) Concept explanation with one concrete example. 3) Common mistakes (2-3) — each as "Learners often think X, but actually Y because Z". 4) Key takeaways (3 bullets). Plain text, no markdown headings (use CAPS labels like WHAT YOU WILL LEARN:), no markdown fences in the prose. Then on its own line write exactly ${LESSON_EXAMPLE_MARKER}, then one line with the code language, then a complete runnable code example for the lesson (no fences). Return ONLY the lesson text, nothing else.`
}

/**
 * JSON variant: same calibration, but the model returns a validated block
 * document (see LESSON_JSON_CONTRACT) instead of prose. Preferred path —
 * the worker uses buildLessonPartPrompt for bounded parts and merges them.
 */
export function buildLessonJsonPrompt({ title, objective, level = "Beginner", style = "Mixed", goal = "" }: LessonPromptInput): string {
  const levelGuidance =
    level === "Advanced"
      ? "Assume strong fundamentals. Go deep fast: internals, edge cases, performance trade-offs, and when NOT to use this. No hand-holding, no beginner analogies. "
      : level === "Intermediate"
        ? "Assume basic familiarity. Define advanced jargon once on first use, then go deeper: trade-offs, common production pitfalls, and how this connects to bigger systems. "
        : "Assume no prior knowledge. Scaffold generously: define every piece of jargon in plain words, use one vivid real-world analogy, build understanding in small steps with a runnable example after each idea. "
  return `Write an Extended (~10-minute read) in-depth lesson titled "${title}"${goal ? ` for a learner whose goal is "${goal}"` : ""}. Starting point: ${objective || "the lesson title"}. ${levelGuidance}${lessonStyleGuidance(style)}Cover in depth: learning objectives; concept explanation spanning what it is, WHY it works that way, and when NOT to use it; 3 graduated runnable code examples (minimal syntax first, then realistic applied scenario, then edge case or common mistake with fix) each in its own {"type":"code"} block with real line breaks; one concrete real-world use case; 2-3 common mistakes, each stated as "Learners often think X, but actually Y because Z"; a mandatory PRACTICE SET of 3-4 exercises graduated from recall to apply to build, each as {"type":"exercise"} with a full solution (never skip this section); 1-2 {"type":"check"} questions testing key ideas; key takeaways as {"type":"recap"}; helpful {"type":"resources"}. Put EVERY code sample in its own {"type":"code"} block with real line breaks and the correct language (e.g. python) — never write code inside paragraph, bullets, or exercise text, and never use markdown fences. Depth over brevity, but no filler: every section must teach something new. ${LESSON_JSON_CONTRACT}`
}

/**
 * Third of an Extended lesson. A single generation of the whole lesson
 * (~8000 tokens) takes minutes on NVIDIA NIMs — far past the ~60s serverless
 * invocation cap — so the worker writes it in three bounded parts and merges
 * the section arrays. `foundation` covers objectives + what/why + one example,
 * `applied` covers the remaining code examples + use case + mistakes, and
 * `practice` closes with the exercise set, checks, and recap.
 * `priorHeadings` (from earlier parts) keeps these stateless calls continuous
 * instead of repeating topics.
 */
export type LessonPartKind = "foundation" | "examples" | "context" | "practice"

const PART_LABELS: Record<LessonPartKind, string> = {
  foundation: "foundation — concepts",
  examples: "applied — graduated code examples",
  context: "applied — real-world use case and common mistakes",
  practice: "practice and close",
}

const PART_NUMBERS: Record<LessonPartKind, number> = { foundation: 1, examples: 2, context: 3, practice: 4 }
const PART_TOTAL = 4

/**
 * Fourth of an Extended lesson. One generation of the whole lesson (~8000
 * tokens) takes minutes on NVIDIA NIMs — far past the ~60s serverless
 * invocation cap — so the worker writes it in four bounded parts and merges
 * the section arrays. Live probes sized each part: 1 basic example / 2 applied
 * examples / use case + mistakes / practice set, all under ~1500 tokens each.
 * `priorHeadings` (from earlier parts) keeps these stateless calls continuous
 * instead of repeating topics.
 */
export function buildLessonPartPrompt(
  { title, objective, level = "Beginner", style = "Mixed", goal = "" }: LessonPromptInput,
  part: LessonPartKind,
  priorHeadings: string[] = [],
  priorConcepts: string[] = []
): string {
  const levelGuidance =
    level === "Advanced"
      ? "Assume strong fundamentals. Go deep fast: internals, edge cases, performance trade-offs, and when NOT to use this. No hand-holding, no beginner analogies. "
      : level === "Intermediate"
        ? "Assume basic familiarity. Define advanced jargon once on first use, then go deeper: trade-offs, common production pitfalls, and how this connects to bigger systems. "
        : "Assume no prior knowledge. Scaffold generously: define every piece of jargon in plain words, use one vivid real-world analogy, build understanding in small steps with a runnable example after each idea. "
  const continuity =
    priorHeadings.length > 0
      ? ` Earlier parts of this lesson already covered these sections, do NOT repeat them — continue the lesson: ${priorHeadings.map((h) => `"${h.slice(0, 80)}"`).join(", ")}.\n`
      : ""
  const conceptBridge =
    priorConcepts.length > 0
      ? ` Build directly on these concepts introduced earlier — reference and extend them, do not reintroduce: ${priorConcepts.map((c) => `"${c.slice(0, 80)}"`).join(", ")}.\n`
      : ""
  const bodies: Record<LessonPartKind, string> = {
    foundation:
      "Cover ONLY this part: learning objectives; the concept explained in depth — what it is, WHY it works that way, and when NOT to use it — plus ONE basic runnable code example showing minimal syntax. Do NOT write further code examples, use cases, mistakes, exercises, checks, recaps, or resources — later parts cover those. State what the next part will extend so the writer after you knows what to build on.",
    examples:
      'Cover ONLY this part: 3 graduated runnable code examples — (1) minimal syntax building on the foundation example, (2) a realistic applied scenario, (3) an edge case or common mistake with its fix — each in its own {"type":"code"} block, each introduced by one short paragraph saying what it shows. Reference the foundation example explicitly ("Building on the example above..."). Do NOT write objectives, a first explanation, use cases, mistakes, exercises, checks, recaps, or resources — other parts cover those.',
    context:
      "Cover ONLY this part: one concrete real-world use case showing where this is used in production; 2-3 common mistakes, each stated as \"Learners often think X, but actually Y because Z\". Do NOT write objectives, a first explanation, code examples, exercises, checks, recaps, or resources — other parts cover those.",
    practice:
      'Cover ONLY this part: a mandatory PRACTICE SET of 3-4 exercises graduated from recall to apply to build — (1) recall: define or identify a key idea, (2) apply: write code from a spec, (3) build: extend or modify existing code — each as {"type":"exercise"} with a full solution (never skip this section); 1-2 {"type":"check"} questions testing the key ideas; key takeaways as {"type":"recap"}; helpful {"type":"resources"}. Do NOT repeat the explanation or code examples — other parts cover those.',
  }
  const stylePart = part === "practice" ? "Weight it toward hands-on practice. " : lessonStyleGuidance(style)
  return `Write PART ${PART_NUMBERS[part]} of ${PART_TOTAL} (${PART_LABELS[part]}) of an Extended in-depth lesson titled "${title}"${goal ? ` for a learner whose goal is "${goal}"` : ""}. Starting point: ${objective || "the lesson title"}. ${levelGuidance}${stylePart}${continuity}${conceptBridge}${bodies[part]} Put EVERY code sample in its own {"type":"code"} block with real line breaks and the correct language (e.g. python) — never write code inside paragraph, bullets, or exercise text, and never use markdown fences. Depth over brevity, but no filler: every section must teach something new. ${LESSON_JSON_CONTRACT}`
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
