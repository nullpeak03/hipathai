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
  | { type: "recap"; items: string[] }

export type LessonContent = { sections: LessonBlock[] }

const MAX_TEXT = 2000
const MAX_ITEMS = 12
const MAX_CODE = 4000

function cleanStr(v: unknown, max = MAX_TEXT): string | null {
  if (typeof v !== "string") return null
  const t = v.trim().replace(/\s+/g, " ").slice(0, max)
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
      const code = cleanStr(r.code, MAX_CODE)
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
      const solution = cleanStr(r.solution ?? r.answer)
      return solution ? { type: "exercise", prompt, solution } : { type: "exercise", prompt }
    }
    case "recap": {
      const items = cleanList(r.items)
      return items ? { type: "recap", items } : null
    }
    default:
      return null
  }
}

/** Validate a raw model payload into a LessonContent, or null if unusable. */
export function normalizeLessonContent(input: unknown): LessonContent | null {
  const sections = (input as { sections?: unknown } | null)?.sections
  if (!Array.isArray(sections) || sections.length === 0) return null
  const blocks = sections
    .map(normalizeBlock)
    .filter((b): b is LessonBlock => b !== null)
    .slice(0, 40)
  // Require at least one substantive block (not just headings).
  const substantive = blocks.some((b) =>
    b.type === "paragraph" || b.type === "bullets" || b.type === "code" ||
    b.type === "exercise" || b.type === "objectives" || b.type === "recap"
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
    }
  }
  return parts.join("\n\n").slice(0, 6000)
}

/** Type guard for rows loaded from Supabase/localStorage. */
export function isLessonContent(v: unknown): v is LessonContent {
  return normalizeLessonContent(v) !== null
}

/** JSON contract text for generation prompts. */
export const LESSON_JSON_CONTRACT =
  `Return ONLY valid JSON shaped exactly like this: {"sections":[{...}]} where each section is one of: ` +
  `{"type":"objectives","items":["..."]}, {"type":"heading","text":"..."}, {"type":"paragraph","text":"..."}, ` +
  `{"type":"bullets","items":["..."]}, {"type":"code","language":"python","code":"..."}, ` +
  `{"type":"callout","kind":"tip|warning|key","text":"..."}, {"type":"exercise","prompt":"...","solution":"..."}, ` +
  `{"type":"recap","items":["..."]}. No explanatory text, no markdown fences.`
