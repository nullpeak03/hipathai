import { describe, expect, it } from "vitest"
import {
  describePlan,
  remainingBudgetMs,
  remediationPlan,
  LESSON_ATTEMPT_BUDGET_MS,
  MIN_REMEDIATION_MS,
  type PartState,
} from "./lesson-budget"

const full: PartState[] = [
  { kind: "foundation", present: true, score: 90 },
  { kind: "examples", present: true, score: 85 },
  { kind: "context", present: true, score: 60 },
  { kind: "practice", present: true, score: 80 },
]

const withMissing = (kind: PartState["kind"]): PartState[] =>
  full.map((part) => (part.kind === kind ? { ...part, present: false, score: 0 } : part))

const plenty = LESSON_ATTEMPT_BUDGET_MS

describe("remainingBudgetMs", () => {
  it("counts down from the attempt start", () => {
    expect(remainingBudgetMs(1_000, 61_000)).toBe(LESSON_ATTEMPT_BUDGET_MS - 60_000)
  })
  it("never goes negative", () => {
    expect(remainingBudgetMs(0, LESSON_ATTEMPT_BUDGET_MS + 10_000)).toBe(0)
  })
})

describe("remediationPlan", () => {
  it("does nothing when the lesson is complete and good enough", () => {
    expect(remediationPlan({ parts: full, score: 92, remainingMs: plenty })).toEqual({
      kind: "none",
      reason: "complete",
    })
  })

  it("repairs essential parts even when the score is high", () => {
    const plan = remediationPlan({ parts: withMissing("practice"), score: 95, remainingMs: plenty })
    expect(plan).toEqual({ kind: "repair", parts: ["practice"] })
  })

  it("leaves a missing optional part alone once the lesson scores well", () => {
    // A context section is worth ~5 points; spending another 100s call on a
    // lesson that already clears the bar is the latency bug this replaces.
    const plan = remediationPlan({ parts: withMissing("context"), score: 88, remainingMs: plenty })
    expect(plan).toEqual({ kind: "none", reason: "good-enough" })
  })

  it("repairs a missing optional part while the lesson is still weak", () => {
    const plan = remediationPlan({ parts: withMissing("context"), score: 72, remainingMs: plenty })
    expect(plan).toEqual({ kind: "repair", parts: ["context"] })
  })

  it("regenerates the weakest part only when nothing is missing", () => {
    const plan = remediationPlan({ parts: full, score: 55, remainingMs: plenty })
    expect(plan).toEqual({ kind: "regenerate", part: "context" })
  })

  it("never repairs and regenerates in the same attempt", () => {
    const parts = withMissing("examples").map((part) =>
      part.kind === "context" ? { ...part, score: 10 } : part
    )
    expect(remediationPlan({ parts, score: 40, remainingMs: plenty })).toEqual({
      kind: "repair",
      parts: ["examples"],
    })
  })

  it("skips remediation instead of overrunning the attempt budget", () => {
    const tight = MIN_REMEDIATION_MS - 1
    expect(remediationPlan({ parts: withMissing("practice"), score: 40, remainingMs: tight })).toEqual({
      kind: "none",
      reason: "out-of-time",
    })
    expect(remediationPlan({ parts: full, score: 20, remainingMs: tight })).toEqual({
      kind: "none",
      reason: "out-of-time",
    })
  })

  it("starts remediation with exactly the minimum budget left", () => {
    expect(
      remediationPlan({ parts: withMissing("practice"), score: 40, remainingMs: MIN_REMEDIATION_MS })
    ).toEqual({ kind: "repair", parts: ["practice"] })
  })
})

describe("describePlan", () => {
  it("is stable for logs", () => {
    expect(describePlan({ kind: "repair", parts: ["practice", "context"] })).toBe("repair practice+context")
    expect(describePlan({ kind: "regenerate", part: "examples" })).toBe("regenerate examples")
    expect(describePlan({ kind: "none", reason: "out-of-time" })).toBe("none (out-of-time)")
  })
})
