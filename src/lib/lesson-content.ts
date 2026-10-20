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

export type LessonPartKind = "foundation" | "examples" | "context" | "practice"

const PART_LABELS: Record<LessonPartKind, string> = {
  foundation: "foundation — concepts",
  examples: "applied — graduated code examples",
  context: "applied — real-world use case and common mistakes",
  practice: "practice and close",
}

const PART_NUMBERS: Record<LessonPartKind, number> = { foundation: 1, examples: 2, context: 3, practice: 4 }
const PART_TOTAL = 4

// Few-shot exemplars per lesson part — teaches Ultra the exact block structure and quality bar.
const PART_EXEMPLARS: Record<LessonPartKind, string> = {
  foundation: `Example "foundation" output for "Async/Await in JavaScript":
{"sections":[
  {"type":"objectives","items":["Explain the event loop and microtask queue","Implement async/await error handling with try/catch"]},
  {"type":"heading","text":"Why Async/Await Exists"},
  {"type":"paragraph","text":"JavaScript is single-threaded but non-blocking. The event loop processes synchronous code first, then microtasks (Promise callbacks), then macrotasks (setTimeout). Async/await is syntactic sugar over Promises that makes asynchronous code read like synchronous code."},
  {"type":"code","language":"javascript","code":"// Microtask queue demo\nconsole.log('1');\nPromise.resolve().then(() => console.log('2'));\nconsole.log('3');\n// Output: 1, 3, 2"},
  {"type":"callout","kind":"key","text":"await only pauses the current function, not the whole thread."}
]}`,

  examples: `Example "examples" output for "Async/Await in JavaScript":
{"sections":[
  {"type":"heading","text":"Code Examples"},
  {"type":"paragraph","text":"Building on the foundation example above, here is one runnable example aligned to the lesson objective."},
  {"type":"code","language":"javascript","code":"// Example: fetch with async/await\nasync function fetchUser(id) {\n  const response = await fetch(\`/api/users/\${id}\`);\n  if (!response.ok) throw new Error('User not found');\n  return response.json();\n}"}
]}`,

  context: `Example "context" output for "Async/Await in JavaScript":
{"sections":[
  {"type":"heading","text":"Real-World Use Case: Building a Resilient API Client"},
  {"type":"paragraph","text":"Production systems need retries, timeouts, and circuit breakers. Here's a pattern used at scale:"},
  {"type":"code","language":"javascript","code":"class ApiClient {\n  constructor(baseUrl, { timeout = 5000, retries = 3 } = {}) {\n    this.baseUrl = baseUrl;\n    this.timeout = timeout;\n    this.retries = retries;\n  }\n\n  async request(path, options = {}) {\n    const url = \`\${this.baseUrl}\${path}\`;\n    for (let attempt = 0; attempt <= this.retries; attempt++) {\n      try {\n        const controller = new AbortController();\n        const timeoutId = setTimeout(() => controller.abort(), this.timeout);\n        const response = await fetch(url, { ...options, signal: controller.signal });\n        clearTimeout(timeoutId);\n        if (!response.ok) throw new Error(\`HTTP \${response.status}\`);\n        return response.json();\n      } catch (err) {\n        if (attempt === this.retries) throw err;\n        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt))); // exponential backoff\n      }\n    }\n  }\n}"},
  {"type":"heading","text":"Common Mistakes"},
  {"type":"paragraph","text":"Learners often think async/await makes code run in parallel, but actually it sequences awaits unless you use Promise.all. The fix: group independent awaits with Promise.all."},
  {"type":"callout","kind":"warning","text":"Sequential awaits in a loop are a performance killer — use Promise.all with map instead."},
  {"type":"callout","kind":"key","text":"Always handle Promise rejections — unhandled rejections crash Node.js processes."}
]}`,

  practice: `Example "practice" output for "Async/Await in JavaScript":
{"sections":[
  {"type":"heading","text":"Practice Set"},
  {"type":"exercise","prompt":"Recall: What is the output order of this code and why?\nconsole.log('A');\nPromise.resolve().then(() => console.log('B'));\nconsole.log('C');\nawait Promise.resolve();\nconsole.log('D');","solution":"Output: A, C, B, D. Synchronous code (A, C) runs first. Microtask (B) runs after current tick. The await Promise.resolve() yields to the microtask queue, so B runs before D."},
  {"type":"exercise","prompt":"Apply: Write a function fetchAll(urls) that fetches all URLs concurrently and returns results in the same order, throwing on first failure.","solution":"async function fetchAll(urls) {\n  const responses = await Promise.all(urls.map(u => fetch(u)));\n  for (const res of responses) if (!res.ok) throw new Error('Fetch failed');\n  return Promise.all(responses.map(r => r.json()));\n}"},
  {"type":"exercise","prompt":"Build: Extend the ApiClient above with a circuit breaker that stops requests after 5 consecutive failures for 30 seconds.","solution":"Add failure counter and lastFailureTime. In request(), check if failures >= 5 and Date.now() - lastFailureTime < 30000 — if so, throw immediately. On success, reset counter. On failure, increment and update lastFailureTime."},
  {"type":"check","prompt":"What does await Promise.all([p1, p2]) do?","options":["Runs p1 then p2 sequentially","Runs p1 and p2 in parallel, waits for both","Races p1 and p2, returns first to settle","Creates a new promise that never settles"],"correct":1,"explanation":"Promise.all runs all promises concurrently and resolves when all settle. It does not sequence them."},
  {"type":"recap","items":["Async/await is syntactic sugar over Promises","await pauses only the current function, not the thread","Use Promise.all for parallelism, sequential await for dependencies","Always handle errors with try/catch or .catch()"]},
  {"type":"resources","items":[{"label":"MDN async/await","url":"https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function"},{"label":"Jake Archibald — Tasks, microtasks, queues","url":"https://jakearchibald.com/2015/tasks-microtasks-queues/"}]}
]}`
}

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
  return `Write an Extended (~10-minute read) in-depth lesson titled "${title}"${goal ? ` for a learner whose goal is "${goal}"` : ""}. Starting point: ${objective || "the lesson title"}. ${levelGuidance}${lessonStyleGuidance(style)}Cover in depth: learning objectives; concept explanation spanning what it is, WHY it works that way, and when NOT to use it; 1-2 runnable code examples directly aligned to the lesson objective, each in its own {"type":"code"} block with real line breaks; one concrete real-world use case appropriate to the learner level and aligned to the objective; 2-3 common mistakes directly related to this lesson, each stated as "Learners often think X, but actually Y because Z"; a mandatory PRACTICE SET of 3-4 exercises graduated from recall to apply to build, each as {"type":"exercise"} with a full solution (never skip this section); 1-2 {"type":"check"} questions testing key ideas; key takeaways as {"type":"recap"}; helpful {"type":"resources"}. Scope control: every section must directly serve the lesson objective; do not introduce advanced or unrelated topics; examples must use only concepts already introduced in this lesson. Put EVERY code sample in its own {"type":"code"} block with real line breaks and the correct language (e.g. python) — never write code inside paragraph, bullets, or exercise text, and never use markdown fences. Depth over brevity, but no filler: every section must teach something new. Scope control: every section must directly serve the lesson objective; do not introduce advanced or unrelated topics; examples must use only concepts already introduced in this lesson. ${LESSON_JSON_CONTRACT}`
}

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
      'Cover ONLY this part: 1-2 runnable code examples directly aligned to the lesson objective — each in its own {"type":"code"} block, each introduced by one short paragraph saying what it shows. Use only concepts already introduced in this lesson. Do NOT write objectives, a first explanation, use cases, mistakes, exercises, checks, recaps, or resources — other parts cover those.',
    context:
      "Cover ONLY this part: one concrete real-world use case appropriate to the learner level and aligned to the lesson objective; 2-3 common mistakes directly related to this lesson, each stated as \"Learners often think X, but actually Y because Z\". Do NOT write objectives, a first explanation, code examples, exercises, checks, recaps, or resources — other parts cover those.",
    practice:
      'Cover ONLY this part: a mandatory PRACTICE SET of 3-4 exercises graduated from recall to apply to build — (1) recall: define or identify a key idea, (2) apply: write code from a spec, (3) build: extend or modify existing code — each as {"type":"exercise"} with a full solution (never skip this section); 1-2 {"type":"check"} questions testing the key ideas; key takeaways as {"type":"recap"}; helpful {"type":"resources"}. Do NOT repeat the explanation or code examples — other parts cover those.',
  }
  const stylePart = part === "practice" ? "Weight it toward hands-on practice. " : lessonStyleGuidance(style)
  const exemplar = PART_EXEMPLARS[part]
  return `Write PART ${PART_NUMBERS[part]} of ${PART_TOTAL} (${PART_LABELS[part]}) of an Extended in-depth lesson titled "${title}"${goal ? ` for a learner whose goal is "${goal}"` : ""}. Starting point: ${objective || "the lesson title"}. ${levelGuidance}${stylePart}${continuity}${conceptBridge}${bodies[part]}

Few-shot exemplar for this part (match this exact block structure and quality):
${exemplar}

Put EVERY code sample in its own {"type":"code"} block with real line breaks and the correct language (e.g. python) — never write code inside paragraph, bullets, or exercise text, and never use markdown fences. Depth over brevity, but no filler: every section must teach something new. Scope control: every section must directly serve the lesson objective; do not introduce advanced or unrelated topics; examples must use only concepts already introduced in this lesson. ${LESSON_JSON_CONTRACT}`
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