import { describe, expect, it } from "vitest"
import {
  buildAnalyticsDays,
  buildCoachingInsight,
  buildTopicMastery,
  compareWeekToDate,
  formatMinutes,
  longestActiveRun,
  masteryBand,
  percentDelta,
  rankWeakSkills,
  summarizeMastery,
  summarizeRange,
  summarizeRoadmap,
  summarizeXp,
} from "./analytics-insights"
import type { ActivityDay, Gamification, RoadmapData } from "./store"

const NOW = new Date("2026-11-08T12:00:00.000Z")

const ACTIVITY: ActivityDay[] = [
  { date: "2026-10-28", minutes: 50, xp: 50, lessons: 2 },
  { date: "2026-11-02", minutes: 30, xp: 30, lessons: 2 },
  { date: "2026-11-04", minutes: 15, xp: 15, lessons: 1 },
  { date: "2026-11-06", minutes: 45, xp: 45, lessons: 3 },
  { date: "2026-11-08", minutes: 10, xp: 10, lessons: 1 },
]

const GAM: Gamification = {
  xp: 240,
  level: 2,
  streak: 1,
  bestStreak: 3,
  passRate: 75,
  studyMinutes: 100,
  lessonsDone: 7,
  lastStudyDate: "2026-11-08",
}

describe("summarizeRange", () => {
  it("summarizes the selected window", () => {
    const summary = summarizeRange(ACTIVITY, 7, NOW)
    expect(summary.minutes).toBe(100)
    expect(summary.xp).toBe(100)
    expect(summary.lessons).toBe(7)
    expect(summary.activeDays).toBe(4)
    expect(summary.consistency).toBe(57)
    expect(summary.avgMinutesPerActiveDay).toBe(25)
    expect(summary.bestDay?.key).toBe("2026-11-06")
    expect(summary.longestRun).toBe(1)
    expect(summary.previous?.minutes).toBe(50)
    expect(summary.deltas.minutes).toBe(100)
    expect(summary.deltas.activeDays).toBe(300)
  })

  it("returns no comparison for a 90-day view", () => {
    const summary = summarizeRange(ACTIVITY, 90, NOW)
    expect(summary.previous).toBeNull()
    expect(summary.deltas).toEqual({ minutes: null, xp: null, activeDays: null })
  })
})

describe("compareWeekToDate", () => {
  it("compares Monday-to-today with the same span last week", () => {
    const week = compareWeekToDate(ACTIVITY, NOW)
    expect(week.currentMinutes).toBe(100)
    expect(week.previousMinutes).toBe(50)
    expect(week.deltaPct).toBe(100)
    expect(week.currentActiveDays).toBe(4)
    expect(week.previousActiveDays).toBe(1)
  })
})

describe("mastery helpers", () => {
  it("averages repeated topic records and assigns bands", () => {
    const topics = buildTopicMastery([
      { topic: "Recursion", mastery_score: 50 },
      { topic: "recursion", mastery_score: 70, attempts: 2 },
      { topic: "Arrays", mastery_score: 95 },
    ])
    expect(topics).toHaveLength(2)
    expect(topics.find((topic) => topic.topic.toLowerCase() === "recursion")).toMatchObject({
      score: 60,
      attempts: 2,
      band: "developing",
    })
    expect(masteryBand(90)).toBe("mastered")
    expect(masteryBand(89)).toBe("proficient")
    expect(masteryBand(49)).toBe("needs-practice")
  })

  it("falls back to aggregate analytics when no topic records exist", () => {
    const summary = summarizeMastery([], { total: 4, average: 72, mastered: 1, lowMastery: ["Graphs"] })
    expect(summary).toMatchObject({ average: 72, total: 4, mastered: 1, hasData: true })
    expect(summary.topics).toEqual([])
  })

  it("ranks merged weak skills by severity without duplicates", () => {
    const topics = buildTopicMastery([
      { topic: "Recursion", mastery_score: 45 },
      { topic: "Arrays", mastery_score: 95 },
    ])
    const weak = rankWeakSkills(topics, [{ topic: "recursion", fail_count: 3 }], ["Graphs"])
    expect(weak.map((skill) => skill.topic.toLowerCase())).toEqual(["recursion", "graphs"])
    expect(weak[0]).toMatchObject({ score: 45, failCount: 3 })
    expect(weak[1]).toMatchObject({ score: null, reason: "Flagged for extra practice" })
  })
})

describe("coaching insight", () => {
  const base = {
    gam: GAM,
    mastery: summarizeMastery([], null),
    weakSkills: [],
    nextLesson: {
      title: "Binary search",
      detail: "Next lesson",
      reason: "Next up",
      href: "/roadmap/r1/lesson/l1",
    },
    hasRoadmap: true,
  }

  it("asks a brand-new learner to start", () => {
    const insight = buildCoachingInsight({
      ...base,
      summary: summarizeRange([], 30, NOW),
    })
    expect(insight.tone).toBe("start")
    expect(insight.cta.href).toBe("/roadmap/r1/lesson/l1")
  })

  it("points at the weakest skill when it is clearly behind", () => {
    const insight = buildCoachingInsight({
      ...base,
      summary: summarizeRange(ACTIVITY, 30, NOW),
      weakSkills: [
        {
          topic: "Recursion",
          score: 45,
          failCount: 1,
          severity: 30,
          reason: "Mastery is below 50%",
        },
      ],
    })
    expect(insight.tone).toBe("focus")
    expect(insight.headline).toContain("Recursion")
    expect(insight.cta.href).toContain("/tutor?q=")
  })

  it("prioritizes consistency when the learner is irregular", () => {
    const summary = summarizeRange([{ date: "2026-11-08", minutes: 5, xp: 5, lessons: 1 }], 30, NOW)
    const insight = buildCoachingInsight({ ...base, summary })
    expect(insight.tone).toBe("build")
    expect(insight.headline).toContain("steadier rhythm")
  })

  it("celebrates a growing streak", () => {
    const insight = buildCoachingInsight({
      ...base,
      gam: { ...GAM, streak: 4 },
      summary: summarizeRange(ACTIVITY, 7, NOW),
    })
    expect(insight.tone).toBe("celebrate")
    expect(insight.headline).toContain("4-day streak")
  })
})

describe("xp and roadmap summaries", () => {
  it("summarizes level progress and xp earned in the range", () => {
    const days = buildAnalyticsDays(ACTIVITY, 7, NOW)
    const xp = summarizeXp(GAM, days)
    expect(xp.level).toBe(2)
    expect(xp.xpInRange).toBe(100)
    expect(xp.remainingToNext).toBe(60)
    expect(xp.xpPerActiveDay).toBe(25)
  })

  it("reports roadmap completion and the current phase", () => {
    const roadmap: RoadmapData = {
      id: "r1",
      title: "Foundations",
      description: "D",
      totalLessons: 3,
      phases: [
        {
          id: "p1",
          title: "Basics",
          lessons: [
            { id: "l1", title: "One" },
            { id: "l2", title: "Two" },
          ],
        },
        { id: "p2", title: "Advanced", lessons: [{ id: "l3", title: "Three" }] },
      ],
    } as RoadmapData
    const summary = summarizeRoadmap(roadmap, { l1: { completed: true, passed: true } }, {})
    expect(summary).toMatchObject({
      hasRoadmap: true,
      pct: 33,
      done: 1,
      remaining: 2,
      currentPhaseTitle: "Basics",
      phaseIndex: 1,
      phasePct: 50,
      lessonsLeftInPhase: 1,
    })
  })
})

describe("small formatting helpers", () => {
  it("formats minutes", () => {
    expect(formatMinutes(0)).toBe("0m")
    expect(formatMinutes(59)).toBe("59m")
    expect(formatMinutes(60)).toBe("1h")
    expect(formatMinutes(125)).toBe("2h 5m")
  })

  it("computes deltas and active runs", () => {
    expect(percentDelta(10, 0)).toBeNull()
    expect(percentDelta(15, 10)).toBe(50)
    const days = buildAnalyticsDays(
      [
        { date: "2026-11-04", minutes: 5, xp: 0, lessons: 1 },
        { date: "2026-11-05", minutes: 5, xp: 0, lessons: 1 },
        { date: "2026-11-06", minutes: 5, xp: 0, lessons: 1 },
      ],
      7,
      NOW
    )
    expect(longestActiveRun(days)).toBe(3)
  })
})
