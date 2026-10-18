import { extractJsonObject } from "./roadmap-normalize"

// Structured lesson content: the model returns a validated block document
// instead of free prose, and LessonBody renders one component per block.
// Unknown/malformed blocks are dropped (never fail the whole lesson).

export type LessonBlock =
  | { type: "objectives"; items: string[] }
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "code"; language: string; code: string; title?: string }
  | { type: "callout"; kind: "tip" | "warning" | "key"; text: string }
  | { type: "exercise"; prompt: string; solution?: string }
  | { type: "image"; url: string; alt?: string; caption?: string }
  | { type: "recap"; items: string[] }
  | { type: "check"; prompt: string; options: string[]; correct: number; explanation?: string }
  | { type: "resources"; items: { label: string; url: string }[] }

export type LessonContent = { sections: LessonBlock[] }

const MAX_TEXT = 2000
const MAX_ITEMS = 12
const MAX_CODE = 4000

function cleanStr(v: unknown, max = MAX_TEXT): string | null {
  if (typeof v !== "string") return null
  const t = v.trim().replace(/\s+/g, " ").slice(0, max)
  return t.length > 0 ? t : null
}

/**
 * Newline-preserving cleanup for code and code-bearing prose (exercise
 * solutions, check explanations). cleanStr collapses \n into spaces, which
 * flattened multi-line samples into paragraph-like single lines.
 */
function cleanCode(v: unknown, max = MAX_CODE): string | null {
  if (typeof v !== "string") return null
  const lines = v
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
  // Trim leading/trailing blank lines, collapse 3+ internal blanks to one.
  while (lines.length > 0 && lines[0]!.trim().length === 0) lines.shift()
  while (lines.length > 0 && lines[lines.length - 1]!.trim().length === 0) lines.pop()
  const out: string[] = []
  let blanks = 0
  for (const l of lines) {
    if (l.trim().length === 0) {
      blanks++
      if (blanks <= 1) out.push("")
    } else {
      blanks = 0
      out.push(l)
    }
  }
  const t = out.join("\n").slice(0, max).trim()
  return t.length > 0 ? t : null
}

function cleanList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null
  const items = v
    .map((x) => (typeof x === "string" ? x.trim().replace(/\s+/g, " ") : ""))
    .filter((x) => x.length > 0)
    .slice(0, MAX_ITEMS)
  return items.length > 0 ? items : null
}

function normalizeBlock(raw: unknown): LessonBlock | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  switch (r.type) {
    case "objectives": {
      const items = cleanList(r.items)
      return items ? { type: "objectives", items } : null
    }
    case "heading": {
      const text = cleanStr(r.text, 200)
      return text ? { type: "heading", text } : null
    }
    case "paragraph": {
      const text = cleanStr(r.text)
      return text ? { type: "paragraph", text } : null
    }
    case "bullets": {
      const items = cleanList(r.items)
      return items ? { type: "bullets", items } : null
    }
    case "code": {
      const code = cleanCode(r.code, MAX_CODE)
      if (!code) return null
      const language = cleanStr(r.language, 30) ?? "text"
      const title = cleanStr(r.title, 120) ?? undefined
      return title ? { type: "code", language, code, title } : { type: "code", language, code }
    }
    case "callout": {
      const text = cleanStr(r.text)
      const kind = r.kind === "warning" || r.kind === "key" ? r.kind : "tip"
      return text ? { type: "callout", kind, text } : null
    }
    case "exercise": {
      const prompt = cleanStr(r.prompt)
      if (!prompt) return null
      const solution = cleanCode(r.solution ?? r.answer)
      return solution ? { type: "exercise", prompt, solution } : { type: "exercise", prompt }
    }
    case "recap": {
      const items = cleanList(r.items)
      return items ? { type: "recap", items } : null
    }
    case "check": {
      const prompt = cleanStr(r.prompt, 500)
      if (!prompt) return null
      if (!Array.isArray(r.options) || r.options.length < 2 || r.options.length > 4) return null
      const options = (r.options as unknown[]).map((o) => typeof o === "string" ? o.trim().replace(/\s+/g, " ") : "").filter(Boolean)
      if (options.length < 2) return null
      const correct = typeof r.correct === "number" && Number.isInteger(r.correct) && r.correct >= 0 && r.correct < options.length ? r.correct : null
      if (correct === null) return null
      const explanation = cleanCode(r.explanation, 500) ?? undefined
      return explanation ? { type: "check", prompt, options, correct, explanation } : { type: "check", prompt, options, correct }
    }
    case "resources": {
      const raw = Array.isArray(r.items) ? r.items : []
      const items = raw.map((x) => {
        if (!x || typeof x !== "object") return null
        const o = x as Record<string, unknown>
        const label = cleanStr(o.label, 120)
        const url = typeof o.url === "string" && /^https?:\/\//.test(o.url.trim()) ? o.url.trim().slice(0, 400) : null
        return label && url ? { label, url } : null
      }).filter((x): x is { label: string; url: string } => x !== null).slice(0, 6)
      return items.length > 0 ? { type: "resources", items } : null
    }
    case "image": {
      const url = typeof r.url === "string" && /^https?:\/\//.test(r.url.trim()) ? r.url.trim() : null
      if (!url) return null
      const alt = cleanStr(r.alt, 200)
      const caption = cleanStr(r.caption, 300)
      return { type: "image", url, ...(alt ? { alt } : {}), ...(caption ? { caption } : {}) }
    }
    default:
      return null
  }
}

const FENCE_RE = /```(\w*)\r?\n([\s\S]*?)```/g

/**
 * Split fenced code spans out of paragraph text into real code blocks.
 * Models leave ``` fences in prose despite the contract — without this they
 * render as flat paragraph mush with visible backticks.
 */
function extractFencedCode(text: string): { text: string; code: Extract<LessonBlock, { type: "code" }>[] } {
  const code: Extract<LessonBlock, { type: "code" }>[] = []
  const stripped = text.replace(FENCE_RE, (_m, lang: string, body: string) => {
    const cleaned = cleanCode(body)
    if (cleaned) code.push({ type: "code", language: (lang || "text").slice(0, 30), code: cleaned })
    return "\n"
  })
  return { text: stripped.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(), code }
}

/** Validate a raw model payload into a LessonContent, or null if unusable. */
export function normalizeLessonContent(input: unknown): LessonContent | null {
  const sections = (input as { sections?: unknown } | null)?.sections
  if (!Array.isArray(sections) || sections.length === 0) return null
  // Split fenced code out of raw paragraphs BEFORE cleaning: cleanStr
  // collapses newlines, which would single-line the extracted code.
  const expanded = sections.flatMap((entry): unknown[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [entry]
    const rec = entry as Record<string, unknown>
    if (rec.type !== "paragraph" || typeof rec.text !== "string" || !rec.text.includes("```")) {
      return [entry]
    }
    const { text, code } = extractFencedCode(rec.text)
    return [
      ...(text ? [{ type: "paragraph", text }] : []),
      ...code.map((c) => ({ type: "code", language: c.language, code: c.code })),
    ]
  })
  const blocks = expanded
    .map(normalizeBlock)
    .filter((b): b is LessonBlock => b !== null)
    .slice(0, 40)
  // Require at least one substantive block (not just headings).
  const substantive = blocks.some((b) =>
    b.type === "paragraph" || b.type === "bullets" || b.type === "code" ||
    b.type === "exercise" || b.type === "objectives" || b.type === "recap" ||
    b.type === "check" || b.type === "resources" || b.type === "image"
  )
  return substantive ? { sections: blocks } : null
}

/** Extract a LessonContent from raw model output (JSON wrapper-tolerant). */
export function parseLessonContent(raw: string): LessonContent | null {
  const extracted = extractJsonObject(raw, ["sections"])
  if (!extracted) return null
  try {
    return normalizeLessonContent(JSON.parse(extracted) as unknown)
  } catch {
    return null
  }
}

/** Flatten blocks to plain text (quiz prompts, search previews). */
export function flattenLessonContent(doc: LessonContent): string {
  const parts: string[] = []
  for (const b of doc.sections) {
    switch (b.type) {
      case "objectives": parts.push(`Objectives: ${b.items.join("; ")}`); break
      case "heading": parts.push(`\n## ${b.text}`); break
      case "paragraph": parts.push(b.text); break
      case "bullets": parts.push(b.items.map((i) => `- ${i}`).join("\n")); break
      case "code": parts.push(`Example (${b.language}):\n${b.code}`); break
      case "callout": parts.push(`${b.kind.toUpperCase()}: ${b.text}`); break
      case "exercise": parts.push(`Exercise: ${b.prompt}${b.solution ? `\nSolution: ${b.solution}` : ""}`); break
      case "recap": parts.push(`Recap: ${b.items.join("; ")}`); break
      case "check": parts.push(`Check: ${b.prompt} — ${b.options.join(" / ")}`); break
      case "resources": parts.push(`Resources: ${b.items.map((r) => `${r.label} (${r.url})`).join("; ")}`); break
      case "image": parts.push(`[Image]${b.alt ? ` ${b.alt}` : ""} ${b.url}`); break
    }
  }
  return parts.join("\n\n").slice(0, 6000)
}

/** Type guard for rows loaded from Supabase/localStorage. */
export function isLessonContent(v: unknown): v is LessonContent {
  return normalizeLessonContent(v) !== null
}

/** Quality score 0-100 for structured lesson content. */
export function lessonQualityScore(doc: LessonContent): number {
  let score = 0
  const has = (type: LessonBlock["type"]) => doc.sections.some((b) => b.type === type)
  if (has("objectives")) score += 15
  if (has("heading")) score += 10
  if (has("paragraph")) score += 15
  const codeBlocks = doc.sections.filter((b) => b.type === "code")
  if (codeBlocks.length > 0) {
    score += 15
    if (codeBlocks.some((b) => (b as Extract<LessonBlock, {type:"code"}>).code.length > 40)) score += 5
    // Real multi-line samples (not paragraph-flattened one-liners).
    if (codeBlocks.some((b) => (b as Extract<LessonBlock, {type:"code"}>).code.includes("\n"))) score += 5
    // Graduated examples: extended lessons show basic THEN applied code.
    if (codeBlocks.length >= 2) score += 5
  }
  // Fence remnants in prose mean code leaked into paragraphs.
  const prose = doc.sections
    .filter((b) => b.type === "paragraph" || b.type === "bullets")
    .map((b) => (b.type === "paragraph" ? b.text : b.items.join("\n")))
    .join("\n")
  if (prose.includes("```")) score -= 10
  const practiceCount = doc.sections.filter((b) => b.type === "exercise" || b.type === "check").length
  if (practiceCount > 0) score += 15
  // Multiple practice items (extended format asks 3-4 exercises).
  if (practiceCount >= 2) score += 5
  // No practice at all means no heavy learning — force regeneration.
  if (practiceCount === 0) score -= 15
  if (has("callout")) score += 5
  if (has("recap")) score += 10
  if (has("resources")) score += 5
  if (has("image")) score += 5
  if (doc.sections.length >= 6) score += 5
  // Extended lessons run 10+ sections; thin ones stop near the minimum.
  if (doc.sections.length >= 10) score += 5
  // Substance floor: extended lessons must actually explain, not list.
  const proseLen = doc.sections
    .filter((b) => b.type === "paragraph" || b.type === "bullets")
    .map((b) => (b.type === "paragraph" ? b.text : b.items.join(" ")).length)
    .reduce((a, b) => a + b, 0)
  if (proseLen > 0 && proseLen < 800) score -= 20
  // Cap and floor
  return Math.max(0, Math.min(100, score))
}

/** JSON contract text for generation prompts. */
export const LESSON_JSON_CONTRACT =
  `Return ONLY valid JSON shaped exactly like this: {"sections":[{...}]} where each section is one of: ` +
  `{"type":"objectives","items":["..."]}, {"type":"heading","text":"..."}, {"type":"paragraph","text":"..."}, ` +
  `{"type":"bullets","items":["..."]}, {"type":"code","language":"python","code":"..."}, ` +
  `{"type":"callout","kind":"tip|warning|key","text":"..."}, {"type":"exercise","prompt":"...","solution":"..."}, ` +
  `{"type":"image","url":"https://...","alt":"description","caption":"optional caption"}, ` +
  `{"type":"check","prompt":"...","options":["..."],"correct":0,"explanation":"..."}, {"type":"resources","items":[{"label":"...","url":"https://..."}]}, ` +
  `{"type":"recap","items":["..."]}. No explanatory text, no markdown fences.`

/** Tutor-specific contract: same blocks, trimmed for chat (no objectives/recap). */
export const TUTOR_JSON_CONTRACT =
  `Return ONLY valid JSON shaped exactly like this: {"sections":[{...}]} where each section is one of: ` +
  `{"type":"heading","text":"..."}, {"type":"paragraph","text":"..."}, {"type":"bullets","items":["..."]}, ` +
  `{"type":"code","language":"python","code":"..."}, {"type":"callout","kind":"tip|warning|key","text":"..."}, ` +
  `{"type":"image","url":"https://...","alt":"description","caption":"optional caption"}, ` +
  `{"type":"check","prompt":"...","options":["..."],"correct":0,"explanation":"..."}, {"type":"resources","items":[{"label":"...","url":"https://..."}]}. ` +
  `Even short replies must be {"sections":[{"type":"paragraph","text":"..."}]} — always the sections wrapper, never a bare block. No explanatory text, no markdown fences.`

/**
 * True when text looks like model JSON (parsed or not): wrapping it as a
 * paragraph would display raw `{"sections":...}` to the user — the exact
 * prod bug behind JSON-visible tutor replies.
 */
export function looksLikeJson(text: string): boolean {
  const t = text.trim()
  if (t.length === 0) return false
  if (!(t.startsWith("{") || t.startsWith("["))) return false
  return t.includes('"sections"') || t.includes('"type"') || t.includes('\\"sections\\"')
}

/** Tutor-structured parse with paragraph fallback for genuine prose only. */
export function parseTutorContent(raw: string): LessonContent | null {
  const parsed = parseLessonContent(raw)
  if (parsed) return parsed
  // Refuse to embalm failed JSON (e.g. heading-only stubs) as display text.
  if (looksLikeJson(raw)) return null
  const trimmed = raw.trim().slice(0, 4000)
  if (trimmed.length === 0) return null
  return { sections: [{ type: "paragraph", text: trimmed.replace(/\s+/g, " ").slice(0, 2000) }] }
}

/** Quality score 0-100 for tutor response blocks. Mirrors lessonQualityScore logic. */
export function tutorQualityScore(doc: LessonContent): number {
  if (!doc || !doc.sections || doc.sections.length === 0) return 0
  let score = 0
  const has = (type: LessonBlock["type"]) => doc.sections.some((b) => b.type === type)
  // Minimum structure
  if (doc.sections.length >= 2) score += 15
  else if (doc.sections.length >= 1) score += 5
  // Code block present (important for CS tutor)
  const codeBlocks = doc.sections.filter((b) => b.type === "code")
  if (codeBlocks.length > 0) {
    score += 20
    if (codeBlocks.some((b) => (b as Extract<LessonBlock, {type:"code"}>).code.length > 40)) score += 5
    if (codeBlocks.some((b) => (b as Extract<LessonBlock, {type:"code"}>).code.includes("\n"))) score += 5
  }
  // Check question present (Socratic method)
  if (has("check")) score += 20
  // Callout (tip/warning/key)
  if (has("callout")) score += 10
  // Resources
  if (has("resources")) score += 10
  // Heading + paragraph structure
  if (has("heading")) score += 5
  if (has("paragraph")) score += 10
  // Prose quality: not too short
  const proseLen = doc.sections
    .filter((b) => b.type === "paragraph" || b.type === "bullets")
    .map((b) => (b.type === "paragraph" ? b.text : b.items.join(" ")).length)
    .reduce((a, b) => a + b, 0)
  if (proseLen > 200) score += 10
  else if (proseLen > 0) score += 5
  // Penalty: JSON-looking content that failed to parse properly
  const rawText = doc.sections
    .filter((b) => b.type === "paragraph")
    .map((b) => b.text)
    .join(" ")
  if (rawText.includes('"sections"') || rawText.includes('"type"')) score -= 15
  return Math.max(0, Math.min(100, score))
}
