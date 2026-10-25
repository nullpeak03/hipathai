import { describe, expect, it } from "vitest"
import { chooseDailyAction } from "./daily-priority"

const roadmap = {
  id: "roadmap-1",
  title: "TypeScript",
  phases: [{
    id: "phase-1",
    title: "Foundations",
    lessons: [
      { id: "lesson-1", title: "Types", estimatedMinutes: 15 },
      { id: "lesson-2", title: "Functions", estimatedMinutes: 20 },
    ],
  }, {
    id: "phase-2",
    title: "Applied Types",
    lessons: [{ id: "lesson-3", title: "Generics", estimatedMinutes: 25 }],
  }],
}

const baseline = {
  roadmap,
  progress: { "lesson-1": { passed: true, completed: true } },
  reviews: [],
  weakTopics: [],
  phaseProgress: {},
  passThreshold: 60,
}

describe("chooseDailyAction", () => {
  it("prioritizes due reviews and explains why", () => {
    const action = chooseDailyAction({
      ...baseline,
      reviews: [{
        lessonId: "lesson-1",
        roadmapId: "roadmap-1",
        title: "Types",
        topic: "Type narrowing",
        overdueDays: 2,
      }],
      weakTopics: [{ topic: "Functions", fail_count: 1 }],
    })

    expect(action).toMatchObject({
      kind: "review",
      title: "Types",
      reason: expect.stringContaining("2 days overdue"),
      href: "/roadmap/roadmap-1/lesson/lesson-1",
    })
  })

  it("uses focused tutor practice for a weak topic before a new lesson", () => {
    const action = chooseDailyAction({
      ...baseline,
      weakTopics: [{ topic: "Functions", fail_count: 2 }],
    })

    expect(action.kind).toBe("practice")
    if (action.kind !== "practice") throw new Error("Expected focused practice")
    expect(action.reason).toContain("missed questions")
    expect(decodeURIComponent(action.href)).toContain("Functions")
  })

  it("selects the first lesson not passed, including a failed lesson retry", () => {
    const action = chooseDailyAction({
      ...baseline,
      progress: {
        "lesson-1": { passed: true, completed: true },
        "lesson-2": { passed: false, completed: true },
      },
    })

    expect(action).toMatchObject({
      kind: "lesson",
      title: "Functions",
      detail: "Continue lesson · Week 1 · About 20 min",
      reason: expect.stringContaining("retry the quiz"),
    })
  })

  it("reports completion only after every lesson is passed", () => {
    const action = chooseDailyAction({
      ...baseline,
      progress: {
        "lesson-1": { passed: true, completed: true },
        "lesson-2": { passed: true, completed: true },
        "lesson-3": { passed: true, completed: true },
      },
    })

    expect(action.kind).toBe("complete")
  })

  it("recommends the phase quiz instead of linking to a locked next phase", () => {
    const action = chooseDailyAction({
      ...baseline,
      progress: {
        "lesson-1": { passed: true, completed: true },
        "lesson-2": { passed: true, completed: true },
      },
    })

    expect(action).toMatchObject({
      kind: "phase",
      title: "Take the Foundations mastery quiz",
      href: "/roadmap",
    })
  })

  it("allows the next phase after the quiz is passed or attempted twice", () => {
    const passed = chooseDailyAction({
      ...baseline,
      progress: {
        "lesson-1": { passed: true, completed: true },
        "lesson-2": { passed: true, completed: true },
      },
      phaseProgress: { "phase-1": { passed: true, attempts: 1 } },
    })
    expect(passed).toMatchObject({ kind: "lesson", title: "Generics" })

    const remedial = chooseDailyAction({
      ...baseline,
      progress: {
        "lesson-1": { passed: true, completed: true },
        "lesson-2": { passed: true, completed: true },
      },
      phaseProgress: { "phase-1": { passed: false, attempts: 2 } },
    })
    expect(remedial).toMatchObject({ kind: "lesson", title: "Generics" })
  })
})
