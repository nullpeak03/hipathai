import { describe, expect, it } from "vitest"
import {
  countPassedLessons,
  estimateRemainingMinutes,
  findNextLesson,
  formatDuration,
  formatTimeUntil,
  getCheckpointStatus,
  getFocusPhaseIndex,
  isLessonLocked,
  isPhaseCheckpointOpen,
  isPhaseComplete,
  remainingSummaryLabel,
  type PhaseShape,
  type ProgressShape,
} from "./roadmap-progress"

const phases: PhaseShape[] = [
  { id: "phase-1", lessons: [{ id: "a" }, { id: "b" }] },
  { id: "phase-2", lessons: [{ id: "c" }, { id: "d", prerequisites: ["a", "b"] }] },
]

function progressWith(...passed: string[]): ProgressShape {
  return Object.fromEntries(passed.map((id) => [id, { completed: true, passed: true }]))
}

describe("roadmap progress helpers", () => {
  it("counts passed lessons across phases", () => {
    expect(countPassedLessons(phases, progressWith("a", "c"))).toBe(2)
    expect(countPassedLessons(phases, {})).toBe(0)
  })

  it("finds the next unpassed lesson in reading order", () => {
    expect(findNextLesson(phases, {})?.lesson.id).toBe("a")
    expect(findNextLesson(phases, progressWith("a"))?.lesson.id).toBe("b")
    expect(findNextLesson(phases, progressWith("a", "b", "c", "d"))).toBeNull()
  })

  it("keeps the first lesson unlocked and gates later lessons on a pass", () => {
    expect(isLessonLocked(phases, 0, 0, {}, {})).toBe(false)
    expect(isLessonLocked(phases, 0, 1, {}, {})).toBe(true)
    expect(isLessonLocked(phases, 0, 1, progressWith("a"), {})).toBe(false)
  })

  it("gates the next phase until its checkpoint is passed", () => {
    const lessonsDone = progressWith("a", "b")
    expect(isLessonLocked(phases, 1, 0, lessonsDone, {})).toBe(true)
    expect(isLessonLocked(phases, 1, 0, lessonsDone, { "phase-1": { passed: true, attempts: 1 } })).toBe(false)
  })

  it("opens the next phase after two failed checkpoint attempts", () => {
    const lessonsDone = progressWith("a", "b")
    expect(
      isLessonLocked(phases, 1, 0, lessonsDone, { "phase-1": { passed: false, attempts: 2 } })
    ).toBe(false)
  })

  it("honours explicit prerequisites over linear order", () => {
    const lessonsDone = progressWith("a", "b", "c")
    expect(isLessonLocked(phases, 1, 1, lessonsDone, { "phase-1": { passed: true, attempts: 1 } })).toBe(false)
    expect(
      isLessonLocked(phases, 1, 1, progressWith("a", "c"), { "phase-1": { passed: true, attempts: 1 } })
    ).toBe(true)
  })

  it("treats an empty prerequisite list as the normal sequential gate", () => {
    const sequential: PhaseShape[] = [{ id: "phase-1", lessons: [{ id: "a", prerequisites: [] }, { id: "b", prerequisites: [] }] }]
    expect(isLessonLocked(sequential, 0, 1, {}, {})).toBe(true)
    expect(isLessonLocked(sequential, 0, 1, progressWith("a"), {})).toBe(false)
  })
})

describe("focus phase", () => {
  it("focuses the first phase with an unpassed lesson", () => {
    expect(getFocusPhaseIndex(phases, {}, {})).toBe(0)
    expect(
      getFocusPhaseIndex(phases, progressWith("a", "b"), { "phase-1": { passed: true, attempts: 1 } })
    ).toBe(1)
  })

  it("keeps focus on a phase whose checkpoint is still blocking", () => {
    expect(getFocusPhaseIndex(phases, progressWith("a", "b"), {})).toBe(0)
  })

  it("focuses the next phase after the two-attempt remedial unlock", () => {
    expect(
      getFocusPhaseIndex(phases, progressWith("a", "b"), { "phase-1": { passed: false, attempts: 2 } })
    ).toBe(1)
  })

  it("focuses a missing checkpoint once every lesson is passed", () => {
    const allLessons = progressWith("a", "b", "c", "d")
    expect(
      getFocusPhaseIndex(phases, allLessons, { "phase-1": { passed: true, attempts: 1 } })
    ).toBe(1)
    expect(getFocusPhaseIndex(phases, allLessons, {})).toBe(0)
  })

  it("returns -1 when lessons and checkpoints are complete", () => {
    expect(
      getFocusPhaseIndex(phases, progressWith("a", "b", "c", "d"), {
        "phase-1": { passed: true, attempts: 1 },
        "phase-2": { passed: true, attempts: 1 },
      })
    ).toBe(-1)
  })
})

describe("checkpoint status", () => {
  it("is locked until every lesson in the phase is passed", () => {
    expect(getCheckpointStatus(phases[0], progressWith("a"), {})).toBe("locked")
  })

  it("moves from ready to retry to remedial", () => {
    const done = progressWith("a", "b")
    expect(getCheckpointStatus(phases[0], done, {})).toBe("ready")
    expect(getCheckpointStatus(phases[0], done, { "phase-1": { passed: false, attempts: 1 } })).toBe("retry")
    expect(getCheckpointStatus(phases[0], done, { "phase-1": { passed: false, attempts: 2 } })).toBe("remedial")
  })

  it("reports a passed checkpoint", () => {
    expect(getCheckpointStatus(phases[0], progressWith("a", "b"), { "phase-1": { passed: true, attempts: 1 } })).toBe(
      "passed"
    )
  })
})

describe("completion semantics", () => {
  it("requires a checkpoint pass even after the remedial unlock", () => {
    const lessonsDone = progressWith("a", "b")
    expect(isPhaseComplete(phases[0], lessonsDone, { "phase-1": { passed: false, attempts: 2 } })).toBe(false)
    expect(isPhaseComplete(phases[0], lessonsDone, { "phase-1": { passed: true, attempts: 3 } })).toBe(true)
  })

  it("does not call a phase complete before its lessons are passed", () => {
    expect(isPhaseComplete(phases[0], progressWith("a"), { "phase-1": { passed: true, attempts: 1 } })).toBe(false)
  })

  it("flags a remedially unlocked phase as checkpoint open", () => {
    const lessonsDone = progressWith("a", "b")
    expect(isPhaseCheckpointOpen(phases[0], lessonsDone, { "phase-1": { passed: false, attempts: 2 } })).toBe(true)
    expect(isPhaseCheckpointOpen(phases[0], lessonsDone, { "phase-1": { passed: false, attempts: 1 } })).toBe(false)
    expect(isPhaseCheckpointOpen(phases[0], lessonsDone, { "phase-1": { passed: true, attempts: 2 } })).toBe(false)
  })
})

describe("time estimates", () => {
  const timed: PhaseShape[] = [
    {
      id: "phase-1",
      lessons: [
        { id: "a", estimatedMinutes: 10 },
        { id: "b", estimatedMinutes: null },
        { id: "c", estimatedMinutes: 0 },
        { id: "d", estimatedMinutes: -3 },
        { id: "e", estimatedMinutes: 30 },
      ],
    },
  ]

  it("sums known durations and falls back for missing or invalid ones", () => {
    expect(estimateRemainingMinutes(timed, progressWith("a"))).toBe(90)
    expect(estimateRemainingMinutes(timed, progressWith("a"), 15)).toBe(75)
  })

  it("skips passed lessons", () => {
    expect(estimateRemainingMinutes(timed, progressWith("a", "b", "c", "d", "e"))).toBe(0)
  })

  it("formats durations compactly", () => {
    expect(formatDuration(0)).toBe("0 min")
    expect(formatDuration(45)).toBe("45 min")
    expect(formatDuration(60)).toBe("1h")
    expect(formatDuration(125)).toBe("2h 5m")
    expect(formatDuration(-10)).toBe("0 min")
  })

  it("formats draft expiry windows", () => {
    const now = 1_000_000
    expect(formatTimeUntil(now - 1, now)).toBe("now")
    expect(formatTimeUntil(now + 45_000, now)).toBe("1 min")
    expect(formatTimeUntil(now + 45 * 60_000, now)).toBe("45 min")
    expect(formatTimeUntil(now + 5 * 60 * 60_000, now)).toBe("5h")
    expect(formatTimeUntil(now + 30 * 60 * 60_000, now)).toBe("1d")
  })

  it("summarizes remaining time or checkpoint debt", () => {
    expect(
      remainingSummaryLabel({ complete: false, remainingLessons: 4, remainingCheckpoints: 2, timeLeft: "1h 20m" })
    ).toBe("≈ 1h 20m left")
    expect(
      remainingSummaryLabel({ complete: false, remainingLessons: 0, remainingCheckpoints: 1, timeLeft: "0 min" })
    ).toBe("1 checkpoint left")
    expect(
      remainingSummaryLabel({ complete: false, remainingLessons: 0, remainingCheckpoints: 3, timeLeft: "0 min" })
    ).toBe("3 checkpoints left")
    expect(
      remainingSummaryLabel({ complete: true, remainingLessons: 0, remainingCheckpoints: 0, timeLeft: "0 min" })
    ).toBe("All lessons passed")
  })
})
