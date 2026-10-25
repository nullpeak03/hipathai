import { describe, expect, it } from "vitest"
import { eligiblePracticeTopics } from "./replan-proposals"

describe("eligiblePracticeTopics", () => {
  it("recommends only repeated weak topics connected to the roadmap", () => {
    expect(eligiblePracticeTopics(
      ["Type narrowing", "Functions"],
      [
        { topic: "type narrowing", fail_count: 3 },
        { topic: "Functions", fail_count: 2 },
        { topic: "Unrelated topic", fail_count: 6 },
      ],
      []
    )).toEqual([{ topic: "Type narrowing", failCount: 3 }])
  })

  it("does not recommend duplicate or previously applied topics", () => {
    expect(eligiblePracticeTopics(
      ["Type narrowing", "Functions"],
      [
        { topic: "Type narrowing", fail_count: 4 },
        { topic: "type narrowing", fail_count: 5 },
        { topic: "Functions", fail_count: 3 },
      ],
      ["functions"]
    )).toEqual([{ topic: "Type narrowing", failCount: 4 }])
  })
})
