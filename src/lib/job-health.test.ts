import { describe, expect, it } from "vitest"
import {
  evaluateJobHealth,
  isPartialJob,
  jobDurationMs,
  jobKind,
  percentile95,
  summarizeJobs,
  type JobRow,
} from "./job-health"

const iso = (ms: number) => new Date(ms).toISOString()
const base = 1_700_000_000_000

function job(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: Math.random().toString(36).slice(2),
    status: "completed",
    started_at: iso(base),
    completed_at: iso(base + 60_000),
    result: { lessonId: "lesson-1" },
    ...overrides,
  }
}

describe("jobKind", () => {
  it("distinguishes roadmap and lesson jobs", () => {
    expect(jobKind({ roadmapId: "r1" })).toBe("roadmap")
    expect(jobKind({ lessonId: "l1" })).toBe("lesson")
    expect(jobKind({ lessonId: "l1", roadmapId: "r1" })).toBe("lesson")
  })

  it("detects quiz jobs before lesson jobs", () => {
    expect(jobKind({ lessonId: "l1", quizCount: 5 })).toBe("quiz")
  })

  it("treats legacy phase counters as roadmap jobs", () => {
    // Production had roadmap failures whose only payload was { totalPhases }
    // — classifying those as "other" hid them from alerting.
    expect(jobKind({ totalPhases: 8 })).toBe("roadmap")
    expect(jobKind({ completedPhases: 2, totalPhases: 8 })).toBe("roadmap")
  })

  it("classifies unknown payloads as other", () => {
    for (const value of [null, undefined, {}, [], "x", 42]) {
      expect(jobKind(value)).toBe("other")
    }
  })
})

describe("jobDurationMs", () => {
  it("prefers explicit telemetry", () => {
    expect(jobDurationMs(job({ result: { lessonId: "l", durationMs: 1234 } }))).toBe(1234)
  })

  it("falls back to timestamps", () => {
    expect(jobDurationMs(job())).toBe(60_000)
  })

  it("ignores unusable values", () => {
    expect(jobDurationMs(job({ result: { lessonId: "l", durationMs: -1 } }))).toBe(60_000)
    expect(jobDurationMs(job({ started_at: null }))).toBeNull()
    expect(jobDurationMs(job({ completed_at: iso(base - 5_000) }))).toBeNull()
    expect(jobDurationMs(job({ started_at: "not-a-date" }))).toBeNull()
  })
})

describe("isPartialJob", () => {
  it("detects missing lesson sections", () => {
    expect(isPartialJob(job({ result: { lessonId: "l", missingParts: ["practice"] } }))).toBe(true)
    expect(isPartialJob(job({ result: { lessonId: "l", missingParts: [] } }))).toBe(false)
    expect(isPartialJob(job({ result: { roadmapId: "r" } }))).toBe(false)
    expect(isPartialJob(job({ result: null }))).toBe(false)
  })
})

describe("percentile95", () => {
  it("uses nearest rank", () => {
    expect(percentile95([])).toBeNull()
    expect(percentile95([500])).toBe(500)
    const values = Array.from({ length: 100 }, (_, i) => i + 1)
    expect(percentile95(values)).toBe(95)
    const twenty = Array.from({ length: 20 }, (_, i) => (i + 1) * 100)
    expect(percentile95(twenty)).toBe(1900)
  })
})

describe("summarizeJobs", () => {
  it("counts only terminal jobs and splits by kind", () => {
    const summary = summarizeJobs([
      job({ result: { lessonId: "l1" } }),
      job({ result: { lessonId: "l2" }, status: "failed" }),
      job({ result: { roadmapId: "r1" }, completed_at: iso(base + 120_000) }),
      job({ status: "processing", completed_at: null }),
    ])
    expect(summary.overall.total).toBe(3)
    expect(summary.overall.completed).toBe(2)
    expect(summary.overall.failed).toBe(1)
    expect(summary.byKind.find((b) => b.kind === "lesson")).toMatchObject({ total: 2, failed: 1 })
    expect(summary.byKind.find((b) => b.kind === "roadmap")).toMatchObject({ total: 1, failed: 0 })
  })

  it("computes partial rate against completed lessons only", () => {
    const summary = summarizeJobs([
      job({ result: { lessonId: "l1", missingParts: ["practice"] } }),
      job({ result: { lessonId: "l2", missingParts: [] } }),
      job({ result: { lessonId: "l3" }, status: "failed" }),
    ])
    const lesson = summary.byKind.find((b) => b.kind === "lesson")!
    expect(lesson.partial).toBe(1)
    expect(lesson.partialRate).toBe(0.5)
  })

  it("is empty-safe", () => {
    const summary = summarizeJobs([])
    expect(summary.overall).toMatchObject({ total: 0, failureRate: 0, p95DurationMs: null })
  })
})

describe("evaluateJobHealth", () => {
  const healthy = summarizeJobs(
    Array.from({ length: 10 }, () => job({ result: { lessonId: "l", missingParts: [] } }))
  )

  it("stays quiet when generation is healthy", () => {
    expect(evaluateJobHealth(healthy)).toEqual([])
  })

  it("alerts on a failure-rate spike", () => {
    const unhealthy = summarizeJobs([
      ...Array.from({ length: 10 }, () => job()),
      ...Array.from({ length: 4 }, () => job({ status: "failed" })),
    ])
    const reasons = evaluateJobHealth(unhealthy)
    expect(reasons.some((r) => /lesson: 4\/14 jobs failed/.test(r))).toBe(true)
  })

  it("ignores tiny samples", () => {
    const tiny = summarizeJobs([job({ status: "failed" }), job()])
    expect(evaluateJobHealth(tiny)).toEqual([])
  })

  it("alerts on slow jobs", () => {
    const slow = summarizeJobs(
      Array.from({ length: 6 }, () => job({ result: { roadmapId: "r", durationMs: 20 * 60_000 } }))
    )
    expect(evaluateJobHealth(slow)).toContain(
      "roadmap: p95 duration 20.0 min exceeds 15.0 min"
    )
  })

  it("alerts when lessons silently ship partial", () => {
    const partial = summarizeJobs(
      Array.from({ length: 6 }, () => job({ result: { lessonId: "l", missingParts: ["context"] } }))
    )
    expect(evaluateJobHealth(partial).some((r) => /missing sections \(100%\)/.test(r))).toBe(true)
  })

  it("does not alert on partial roadmaps", () => {
    const rows = Array.from({ length: 6 }, () =>
      job({ result: { roadmapId: "r", missingParts: ["phase"] } })
    )
    expect(evaluateJobHealth(summarizeJobs(rows))).toEqual([])
  })

  it("alerts on legacy roadmap failures that only carry phase counters", () => {
    const rows = [
      ...Array.from({ length: 4 }, () => job({ result: { totalPhases: 8 } })),
      ...Array.from({ length: 6 }, () => job({ result: { totalPhases: 8 }, status: "failed" })),
    ]
    expect(evaluateJobHealth(summarizeJobs(rows))).toContain(
      "roadmap: 6/10 jobs failed in the last hour (60%)"
    )
  })

  it("alerts on quiz failures too", () => {
    const rows = [
      ...Array.from({ length: 6 }, () => job({ result: { lessonId: "l", quizCount: 5 } })),
      ...Array.from({ length: 2 }, () => job({ result: { lessonId: "l", quizCount: 5 }, status: "failed" })),
    ]
    expect(evaluateJobHealth(summarizeJobs(rows)).some((r) => r.startsWith("quiz:"))).toBe(true)
  })
})
