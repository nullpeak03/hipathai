import { describe, it, expect } from "vitest"
import { describeJobResult } from "./job-status"

describe("describeJobResult", () => {
  it("classifies roadmap results", () => {
    expect(describeJobResult({ roadmapId: "abc", completedPhases: 3 }).kind).toBe("roadmap")
  })
  it("classifies lesson and quiz results by lessonId", () => {
    expect(describeJobResult({ lessonId: "l1" })).toMatchObject({ kind: "lesson", lessonId: "l1" })
    expect(describeJobResult({ lessonId: "l1", quizCount: 6 })).toMatchObject({ kind: "lesson", quizCount: 6 })
    // lessonId wins when both keys present
    expect(describeJobResult({ roadmapId: "r", lessonId: "l1" }).kind).toBe("lesson")
  })
  it("returns unknown for missing/garbage results", () => {
    expect(describeJobResult(null).kind).toBe("unknown")
    expect(describeJobResult(undefined).kind).toBe("unknown")
    expect(describeJobResult("done").kind).toBe("unknown")
    expect(describeJobResult([]).kind).toBe("unknown")
    expect(describeJobResult({}).kind).toBe("unknown")
    expect(describeJobResult({ lessonId: 42 }).kind).toBe("unknown")
  })
})
