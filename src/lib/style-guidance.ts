// Learning-style blending for generation prompts. Onboarding collects styles
// as a comma-joined multi-select ("Visual, Hands-on"); these helpers parse
// that shape and render one guidance paragraph per known style. Unknown
// values are ignored so future styles degrade gracefully.

export const STYLE_GUIDANCE: Record<string, string> = {
  Visual: "Present concepts visually first: lead with analogies and simple text diagrams, then name the formalism.",
  "Hands-on": "Every phase must culminate in a build lesson; prefer implementation over exposition throughout.",
  Theory: "Order foundations first and go deep: first principles, precise terminology, and why things work.",
  Mixed: "Balance explanation, concrete examples, and quick checks evenly.",
  "Project-Based": "Structure learning around tangible builds: each phase produces a working artifact that the next phase extends.",
  Socratic: "Frame lessons as guided inquiry: pose probing questions, surface misconceptions, and make objectives about articulation.",
  "Reading & Research": "Documentation-first: point at concepts to look up, favor source synthesis over hand-holding.",
}

/** Parse a comma-joined (or array) style value into clean tokens. */
export function parseStyles(input: string | string[] | undefined | null): string[] {
  const raw = Array.isArray(input) ? input : typeof input === "string" ? input.split(",") : []
  return raw.map((s) => s.trim()).filter((s) => s.length > 0)
}

/**
 * Render guidance paragraphs for the selected styles (deduped, unknowns
 * dropped). Empty string when nothing known is selected — callers omit the
 * style section in that case.
 */
export function buildStyleGuidance(input: string | string[] | undefined | null): string {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const token of parseStyles(input)) {
    const guidance = STYLE_GUIDANCE[token]
    if (guidance && !seen.has(token)) {
      seen.add(token)
      parts.push(`- ${token}: ${guidance}`)
    }
  }
  return parts.join("\n")
}
