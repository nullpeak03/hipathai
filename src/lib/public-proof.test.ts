import { describe, expect, it } from "vitest"
import { buildProofMetrics, EDITOR_LANGUAGE_COUNT, MIN_PUBLISHED_USAGE } from "./public-proof"

describe("public proof metrics", () => {
  it("publishes usage numbers only at or above the threshold", () => {
    expect(buildProofMetrics({ lessonsGenerated: MIN_PUBLISHED_USAGE - 1 }).some((m) => m.label.includes("lessons"))).toBe(false)
    expect(buildProofMetrics({ lessonsGenerated: MIN_PUBLISHED_USAGE })[0]).toEqual({
      value: "100",
      label: "AI lessons generated",
    })
  })

  it("omits usage numbers when the count is unknown", () => {
    const metrics = buildProofMetrics({ lessonsGenerated: null })
    expect(metrics.some((metric) => metric.label.includes("lessons"))).toBe(false)
  })

  it("formats large counts with thousands separators", () => {
    expect(buildProofMetrics({ lessonsGenerated: 2948 })[0]).toEqual({
      value: "2,948",
      label: "AI lessons generated",
    })
  })

  it("always keeps the verifiable product facts", () => {
    const metrics = buildProofMetrics({ lessonsGenerated: null })
    expect(metrics).toEqual([
      { value: String(EDITOR_LANGUAGE_COUNT), label: "languages in the code editor" },
      { value: "Free", label: "core path, no credit card" },
    ])
  })
})
