import { describe, it, expect } from "vitest"
import { describeJobResult, jobOwnerLookup } from "./job-status"

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

describe("jobOwnerLookup", () => {
  it("trusts the ownership column when it is set", () => {
    expect(jobOwnerLookup({ user_id: "user_1", result: { lessonId: "l1" } }, "job-1")).toEqual({
      via: "job",
    })
  })

  it("falls back to the lesson for legacy lesson and quiz jobs", () => {
    expect(jobOwnerLookup({ user_id: null, result: { lessonId: "l1" } }, "job-1")).toEqual({
      via: "lesson",
      lessonId: "l1",
    })
    expect(jobOwnerLookup({ result: { lessonId: "l1", quizCount: 5 } }, "job-1")).toEqual({
      via: "lesson",
      lessonId: "l1",
    })
  })

  it("falls back to the roadmap id for roadmap jobs, including legacy payloads", () => {
    expect(jobOwnerLookup({ result: { totalPhases: 8 } }, "job-1")).toEqual({
      via: "roadmap",
      roadmapId: "job-1",
    })
    expect(jobOwnerLookup({ result: { roadmapId: "r1" } }, "job-1")).toEqual({
      via: "roadmap",
      roadmapId: "job-1",
    })
  })

  it("ignores an empty ownership value", () => {
    expect(jobOwnerLookup({ user_id: "" }, "job-1")).toEqual({ via: "roadmap", roadmapId: "job-1" })
  })
})
