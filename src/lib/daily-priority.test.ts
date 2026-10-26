import { describe, expect, it } from "vitest"
import { chooseNextLesson } from "./daily-priority"

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
  phaseProgress: {},
  passThreshold: 60,
}

describe("chooseNextLesson", () => {
  it("selects the first lesson not passed, including a failed lesson retry", () => {
    const action = chooseNextLesson({
      ...baseline,
      progress: {
        "lesson-1": { passed: true, completed: true },
        "lesson-2": { passed: false, completed: true },
      },
    })

    expect(action).toMatchObject({
      title: "Functions",
      detail: "Continue lesson · Week 1 · About 20 min",
      reason: expect.stringContaining("retry the quiz"),
      href: "/roadmap/roadmap-1/lesson/lesson-2",
    })
  })

  it("routes through the roadmap when a phase checkpoint still gates the next lesson", () => {
    const action = chooseNextLesson({
      ...baseline,
      progress: {
        "lesson-1": { passed: true, completed: true },
        "lesson-2": { passed: true, completed: true },
      },
    })

    expect(action).toMatchObject({
      title: "Generics",
      detail: "Next lesson · Week 2",
      reason: expect.stringContaining("phase checkpoint"),
      href: "/roadmap",
    })
  })

  it("continues directly to the next phase after its checkpoint is passed or attempted twice", () => {
    const passed = chooseNextLesson({
      ...baseline,
      progress: {
        "lesson-1": { passed: true, completed: true },
        "lesson-2": { passed: true, completed: true },
      },
      phaseProgress: { "phase-1": { passed: true, attempts: 1 } },
    })
    expect(passed).toMatchObject({ title: "Generics", href: "/roadmap/roadmap-1/lesson/lesson-3" })

    const remedial = chooseNextLesson({
      ...baseline,
      progress: {
        "lesson-1": { passed: true, completed: true },
        "lesson-2": { passed: true, completed: true },
      },
      phaseProgress: { "phase-1": { passed: false, attempts: 2 } },
    })
    expect(remedial).toMatchObject({ title: "Generics", href: "/roadmap/roadmap-1/lesson/lesson-3" })
  })

  it("shows a completion state when every lesson has been passed", () => {
    const action = chooseNextLesson({
      ...baseline,
      progress: {
        "lesson-1": { passed: true, completed: true },
        "lesson-2": { passed: true, completed: true },
        "lesson-3": { passed: true, completed: true },
      },
    })

    expect(action).toMatchObject({
      title: "You’ve completed your roadmap",
      href: "/roadmap",
    })
  })

  it("prompts learners without a roadmap to create one", () => {
    expect(chooseNextLesson({ ...baseline, roadmap: null })).toMatchObject({
      title: "Create your learning roadmap",
      href: "/onboarding",
    })
  })
})
