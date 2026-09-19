import { describe, it, expect } from "vitest"
import { toRoadmapData } from "./roadmap-shape"
import type { QuizQuestion } from "./mockData"

const quiz: QuizQuestion[] = [{
  q: "Q?",
  options: ["a", "b", "c", "d"],
  correct: 2,
  explanation: "Because.",
}]

describe("toRoadmapData", () => {
  it("nests lessons under their phase with client field names", () => {
    const data = toRoadmapData(
      { id: "r1", title: "T", description: "D", lessons_total: 2 },
      [
        { id: "p1", idx: 1, title: "P1" },
        { id: "p2", idx: 2, title: "P2" },
      ],
      [
        { id: "l1", phase_id: "p1", idx: 1, title: "L1", content_md: "md", example_code: "ex", quiz },
        { id: "l2", phase_id: "p2", idx: 1, title: "L2", content_md: null, example_code: null, quiz: null },
      ]
    )
    expect(data.id).toBe("r1")
    expect(data.totalLessons).toBe(2)
    expect(data.phases).toHaveLength(2)
    expect(data.phases[0].lessons.map((l) => l.id)).toEqual(["l1"])
    expect(data.phases[1].lessons.map((l) => l.id)).toEqual(["l2"])
    const l1 = data.phases[0].lessons[0]
    expect(l1).toMatchObject({ phaseIdx: 1, contentMd: "md", exampleCode: "ex", isLocked: false, isCompleted: false })
    expect(l1.quiz).toEqual(quiz)
    const l2 = data.phases[1].lessons[0]
    expect(l2).toMatchObject({ contentMd: "", exampleCode: "", quiz: [] })
  })
  it("falls back when counts and descriptions are missing", () => {
    const data = toRoadmapData(
      { id: "r1", title: "T", description: null, lessons_total: null },
      [{ id: "p1", idx: 1, title: "P1" }],
      [{ id: "l1", phase_id: "p1", idx: 1, title: "L1", content_md: null, example_code: null, quiz: null }]
    )
    expect(data.description).toBe("")
    expect(data.totalLessons).toBe(1)
  })
  it("drops lessons whose phase is unknown", () => {
    const data = toRoadmapData(
      { id: "r1", title: "T", description: null, lessons_total: null },
      [{ id: "p1", idx: 1, title: "P1" }],
      [{ id: "orphan", phase_id: "nope", idx: 1, title: "O", content_md: null, example_code: null, quiz: null }]
    )
    expect(data.phases[0].lessons).toHaveLength(0)
    expect(data.totalLessons).toBe(1)
  })
})
