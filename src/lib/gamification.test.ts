import { describe, it, expect } from "vitest"
import {
  getLevel,
  xpForNextLevel,
  progressToNextLevel,
  toGamification,
  toGamificationRow,
} from "./gamification"

describe("getLevel", () => {
  it("starts at level 1 below 100 XP", () => {
    expect(getLevel(0)).toBe(1)
    expect(getLevel(99)).toBe(1)
  })
  it("steps through thresholds", () => {
    expect(getLevel(100)).toBe(2)
    expect(getLevel(299)).toBe(2)
    expect(getLevel(300)).toBe(3)
    expect(getLevel(599)).toBe(3)
    expect(getLevel(600)).toBe(4)
    expect(getLevel(999)).toBe(4)
    expect(getLevel(1000)).toBe(5)
    expect(getLevel(1499)).toBe(5)
  })
  it("scales linearly past level 5", () => {
    expect(getLevel(1500)).toBe(6)
    expect(getLevel(2299)).toBe(6)
    expect(getLevel(2300)).toBe(7)
  })
})

describe("xpForNextLevel", () => {
  it("returns the next threshold", () => {
    expect(xpForNextLevel(1)).toBe(100)
    expect(xpForNextLevel(2)).toBe(300)
    expect(xpForNextLevel(5)).toBe(1500)
    expect(xpForNextLevel(6)).toBe(2300)
    expect(xpForNextLevel(7)).toBe(3100)
  })
})

describe("progressToNextLevel", () => {
  it("reports 0% at fresh start", () => {
    const p = progressToNextLevel(0)
    expect(p).toMatchObject({ level: 1, nextThreshold: 100, progress: 0 })
  })
  it("reports midpoints", () => {
    expect(progressToNextLevel(50).progress).toBe(50)
    expect(progressToNextLevel(200).progress).toBe(50)
  })
  it("resets to 0 exactly on level-up", () => {
    const p = progressToNextLevel(100)
    expect(p.level).toBe(2)
    expect(p.progress).toBe(0)
  })
  it("clamps progress to 0..100", () => {
    const p = progressToNextLevel(10_000_000)
    expect(p.progress).toBeLessThanOrEqual(100)
    expect(p.progress).toBeGreaterThanOrEqual(0)
  })
})

describe("toGamification", () => {
  it("defaults nulls", () => {
    expect(
      toGamification({
        xp: null, level: null, streak: null, best_streak: null,
        pass_rate: null, study_minutes: null, lessons_done: null, last_study_date: null,
      })
    ).toEqual({
      xp: 0, level: 1, streak: 0, bestStreak: 0,
      passRate: 0, studyMinutes: 0, lessonsDone: 0, lastStudyDate: "",
    })
  })
  it("maps snake_case to camelCase", () => {
    const g = toGamification({
      xp: 120, level: 2, streak: 3, best_streak: 5,
      pass_rate: 80, study_minutes: 45, lessons_done: 6, last_study_date: "2026-09-19",
    })
    expect(g).toMatchObject({ xp: 120, level: 2, bestStreak: 5, passRate: 80, studyMinutes: 45, lessonsDone: 6 })
  })
})

describe("toGamificationRow", () => {
  it("floors floats and clamps ranges", () => {
    const row = toGamificationRow({ xp: 150.9, level: 0, streak: -5, passRate: 140, studyMinutes: NaN })
    expect(row.xp).toBe(150)
    expect(row.level).toBe(1)
    expect(row.streak).toBe(0)
    expect(row.pass_rate).toBe(100)
    expect(row.study_minutes).toBe(0)
  })
  it("falls back on non-numeric input and stamps today", () => {
    const row = toGamificationRow({ xp: "abc", level: Infinity })
    expect(row.xp).toBe(0)
    expect(row.level).toBe(1)
    expect(row.last_study_date).toBe(new Date().toISOString().slice(0, 10))
  })
})
