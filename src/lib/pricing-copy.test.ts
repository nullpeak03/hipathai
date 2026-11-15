import { describe, expect, it } from "vitest"
import { fairUseSentence } from "./pricing-copy"

const HOUR = 60 * 60 * 1000
const limits = {
  roadmap: { limit: 5, windowMs: HOUR },
  tutor: { limit: 60, windowMs: HOUR },
  quiz: { limit: 30, windowMs: HOUR },
  code: { limit: 30, windowMs: HOUR },
}

describe("fairUseSentence", () => {
  it("states the enforced hourly ceilings", () => {
    expect(fairUseSentence(limits)).toBe(
      "Current Free fair-use ceilings: 5 new AI roadmaps, 60 AI mentor prompts, 30 quizzes, and 30 code runs per hour, per account."
    )
  })

  it("follows the numbers instead of hard-coding copy", () => {
    const changed = { ...limits, tutor: { limit: 10, windowMs: HOUR } }
    expect(fairUseSentence(changed)).toContain("10 AI mentor prompts")
    expect(fairUseSentence(changed)).not.toContain("60 AI mentor prompts")
  })

  it("falls back to wording that fits mixed windows", () => {
    const mixed = {
      ...limits,
      roadmap: { limit: 2, windowMs: 30 * 24 * HOUR },
    }
    const sentence = fairUseSentence(mixed)
    expect(sentence).toContain("2 new AI roadmaps")
    expect(sentence).toContain("each within its own rolling window")
  })
})
