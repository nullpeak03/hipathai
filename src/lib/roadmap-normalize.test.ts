import { describe, it, expect } from "vitest"
import { normalizeRoadmapJson } from "./roadmap-normalize"

const meta = { goal: "Python", level: "Beginner", duration: "8 weeks" }

// Exact requested schema
const exact = {
  title: "Python Roadmap",
  description: "Learn Python",
  phases: [{
    title: "Basics",
    lessons: [{ title: "Setup", objective: "Install Python." }],
  }],
}

// Real model output observed 2026-09-19: no title/description, extra keys
const deviant = {
  goal: "Python",
  level: "Beginner",
  time_per_day: "1hr",
  duration_weeks: 8,
  total_lessons: 2,
  phases: [
    { phase: 1, title: "Foundations", lessons: [{ title: "Setup and Hello World", objective: "Install Python, run scripts." }] },
    { phase: 2, title: "Next", lessons: [{ title: "Variables", description: "Learn variables." }] },
  ],
}

describe("normalizeRoadmapJson", () => {
  it("passes exact-schema payloads through", () => {
    const out = normalizeRoadmapJson(exact, meta)
    expect(out).toMatchObject({ title: "Python Roadmap", description: "Learn Python" })
    const [phase] = out?.phases ?? []
    expect(out?.phases).toHaveLength(1)
    const [lesson] = phase?.lessons ?? []
    expect(lesson).toMatchObject({ title: "Setup", objective: "Install Python." })
  })
  it("repairs the observed deviant schema", () => {
    const out = normalizeRoadmapJson(deviant, meta)
    expect(out?.title).toBe("Roadmap for Python")
    expect(out?.description).toContain("8 weeks")
    const phases = out?.phases ?? []
    expect(phases).toHaveLength(2)
    // description accepted as objective alias
    const [, second] = phases
    const [secondLesson] = second?.lessons ?? []
    expect(secondLesson?.objective).toBe("Learn variables.")
  })
  it("returns null when nothing usable exists", () => {
    expect(normalizeRoadmapJson(null, meta)).toBeNull()
    expect(normalizeRoadmapJson("nope", meta)).toBeNull()
    expect(normalizeRoadmapJson([], meta)).toBeNull()
    expect(normalizeRoadmapJson({}, meta)).toBeNull()
    expect(normalizeRoadmapJson({ title: "T", phases: [] }, meta)).toBeNull()
    expect(normalizeRoadmapJson({ phases: [{ title: "P", lessons: [] }] }, meta)).toBeNull()
    expect(normalizeRoadmapJson({ phases: [{ lessons: [{ objective: "no title" }] }] }, meta)).toBeNull()
  })
  it("skips untitled lessons and defaults untitled phases", () => {
    const out = normalizeRoadmapJson({
      phases: [{ lessons: [{ title: "  " }, { title: "Real", objective: "Yes." }] }],
    }, meta)
    const [onlyPhase] = out?.phases ?? []
    expect(onlyPhase?.title).toBe("Phase 1")
    expect(onlyPhase?.lessons?.map((l) => l.title)).toEqual(["Real"])
  })
  it("preserves valid embedded quizzes", () => {
    const quiz = [{ q: "Q?", options: ["a", "b", "c", "d"], correct: 1, explanation: "E." }]
    const out = normalizeRoadmapJson({
      title: "T",
      phases: [{ title: "P", lessons: [{ title: "L", objective: "O", quiz }] }],
    }, meta)
    const [quizPhase] = out?.phases ?? []
    const [quizLesson] = quizPhase?.lessons ?? []
    expect(quizLesson?.quiz).toEqual(quiz)
  })
  it("drops invalid embedded quizzes instead of failing", () => {
    const out = normalizeRoadmapJson({
      title: "T",
      phases: [{ title: "P", lessons: [{ title: "L", objective: "O", quiz: [{ nope: 1 }] }] }],
    }, meta)
    const [badPhase] = out?.phases ?? []
    const [badLesson] = badPhase?.lessons ?? []
    expect(badLesson?.quiz).toBeUndefined()
  })
})
