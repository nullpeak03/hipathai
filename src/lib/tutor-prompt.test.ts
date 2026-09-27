import { describe, it, expect } from "vitest"
import { buildSystemPrompt } from "./tutor-prompt"

const ctx = {
  roadmapTitle: "AI Agent Developer with Python",
  phases: [
    {
      title: "Python Foundations",
      lessons: [
        { n: 1, title: "Python Execution Model", done: true },
        { n: 2, title: "Variables and Memory References", done: true },
        { n: 3, title: "Core Data Types and Operations", done: true },
        { n: 4, title: "Control Flow Structures", done: false },
      ],
    },
  ],
  currentLesson: { n: 4, title: "Control Flow Structures" },
  lessonsDone: 3,
  totalLessons: 4,
}

describe("buildSystemPrompt", () => {
  it("marks done lessons and names the current one by number", () => {
    const p = buildSystemPrompt(ctx)
    expect(p).toContain("#1 Python Execution Model ✓done")
    expect(p).toContain("#4 Control Flow Structures")
    expect(p).not.toContain("#4 Control Flow Structures ✓done")
    expect(p).toContain('CURRENT lesson is #4 "Control Flow Structures"')
    expect(p).toContain("never guess")
  })
  it("degrades gracefully without roadmap context", () => {
    const p = buildSystemPrompt({ level: 1 })
    expect(p).toContain("No roadmap yet")
    expect(p).not.toContain("CURRENT lesson")
  })
})
