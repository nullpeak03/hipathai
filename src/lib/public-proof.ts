export type ProofMetric = { value: string; label: string }

/**
 * Usage counts below this are not published. A small early number reads as
 * weak proof, so the marketing pages fall back to verifiable product facts.
 */
export const MIN_PUBLISHED_USAGE = 100

export const EDITOR_LANGUAGE_COUNT = 18

/**
 * Builds the metric strip shown on public pages. Only real, checked values go
 * in: the lesson count when it clears the publishing threshold, plus product
 * facts that can be verified in the app.
 */
export function buildProofMetrics(input: { lessonsGenerated: number | null }): ProofMetric[] {
  const metrics: ProofMetric[] = []
  const lessons = input.lessonsGenerated
  if (typeof lessons === "number" && Number.isFinite(lessons) && lessons >= MIN_PUBLISHED_USAGE) {
    metrics.push({ value: lessons.toLocaleString("en-US"), label: "AI lessons generated" })
  }
  metrics.push({ value: String(EDITOR_LANGUAGE_COUNT), label: "languages in the code editor" })
  metrics.push({ value: "Free", label: "core path, no credit card" })
  return metrics
}
