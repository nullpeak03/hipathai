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
    // New compressed format: "Python Foundations (3/4 done)"
    expect(p).toContain("Python Foundations (3/4 done)")
    expect(p).toContain('CURRENT lesson is #4 "Control Flow Structures"')
    expect(p).toContain("never guess")
  })
  it("degrades gracefully without roadmap context", () => {
    const p = buildSystemPrompt({ level: 1 })
    expect(p).toContain("No roadmap yet")
    expect(p).not.toContain("CURRENT lesson")
  })
  it("includes Socratic teaching method", () => {
    const p = buildSystemPrompt(ctx)
    expect(p).toContain("Socratic first")
    expect(p).toContain("clarifying question")
    expect(p).toContain("max 2 paragraphs")
    expect(p).toContain("check question")
  })
  it("includes code debugging structure", () => {
    const p = buildSystemPrompt(ctx)
    expect(p).toContain("CODE DEBUGGING")
    expect(p).toContain("Identify the likely bug")
    expect(p).toContain("corrected runnable snippet")
    expect(p).toContain("run it and report back")
  })
  it("includes domain boundary", () => {
    const p = buildSystemPrompt(ctx)
    expect(p).toContain("DOMAIN BOUNDARY")
    expect(p).toContain("outside computer science")
    expect(p).toContain("say so politely")
  })
  it("includes streak nudge when idle for days", () => {
    const p = buildSystemPrompt({ ...ctx, streak: 5, minutesSinceLastStudy: 200000 })
    expect(p).toContain("5-day streak")
    expect(p).toContain("days since their last study session")
  })
  it("includes recent quiz scores for remediation", () => {
    const p = buildSystemPrompt({
      ...ctx,
      recentScores: [{ lessonTitle: "Closures", score: 40, passed: false }],
    })
    expect(p).toContain("Closures: 40% (failed)")
    expect(p).toContain("target remediation")
  })
})
