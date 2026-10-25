import { describe, expect, it } from "vitest"
import { sectionsForLessonStage } from "./lesson-flow"
import type { LessonContent } from "./lesson-content-blocks"

const doc: LessonContent = {
  sections: [
    { type: "objectives", items: ["Understand the concept"] },
    { type: "paragraph", text: "Explanation" },
    { type: "code", language: "ts", code: "const answer = 42" },
    { type: "exercise", prompt: "Write a function" },
    { type: "check", prompt: "What is the answer?", options: ["42", "24"], correct: 0 },
    { type: "recap", items: ["The answer is 42"] },
  ],
}

describe("sectionsForLessonStage", () => {
  it("keeps teaching blocks together in their original order", () => {
    expect(sectionsForLessonStage(doc, "teach").map((section) => section.type)).toEqual([
      "objectives",
      "paragraph",
      "recap",
    ])
  })

  it("isolates examples and practice activities", () => {
    expect(sectionsForLessonStage(doc, "example").map((section) => section.type)).toEqual(["code"])
    expect(sectionsForLessonStage(doc, "practice").map((section) => section.type)).toEqual([
      "exercise",
      "check",
    ])
  })
})
