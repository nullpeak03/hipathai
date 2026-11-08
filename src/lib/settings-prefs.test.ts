import { describe, expect, it } from "vitest"
import {
  DEFAULT_PREFERENCES,
  applyAccessibilityPrefs,
  clampDailyGoal,
  clampFontSize,
  diffSectionPreferences,
  formatLastActive,
  isPreferenceSection,
  isSectionDirty,
  normalizePreferences,
  sanitizeSectionPatch,
  type Preferences,
} from "./settings-prefs"
import {
  DEFAULT_SETTINGS_SECTION,
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  getSection,
  normalizeSection,
  sectionsInGroup,
} from "./settings.config"

const prefs: Preferences = {
  email: "learner@example.com",
  emailReminders: true,
  dailyGoalMinutes: 60,
  tutorMode: "direct",
  difficultyPreference: "adaptive",
  reducedMotion: false,
  fontSize: 16,
  highContrast: false,
}

describe("clampDailyGoal", () => {
  it("clamps to the API range and rounds", () => {
    expect(clampDailyGoal(4)).toBe(15)
    expect(clampDailyGoal(500)).toBe(240)
    expect(clampDailyGoal(42.6)).toBe(43)
  })

  it("falls back for non-finite input", () => {
    expect(clampDailyGoal(Number.NaN)).toBe(DEFAULT_PREFERENCES.dailyGoalMinutes)
    expect(clampDailyGoal(Number.POSITIVE_INFINITY)).toBe(DEFAULT_PREFERENCES.dailyGoalMinutes)
  })
})

describe("clampFontSize", () => {
  it("clamps to the API range", () => {
    expect(clampFontSize(8)).toBe(12)
    expect(clampFontSize(25)).toBe(20)
    expect(clampFontSize(14.4)).toBe(14)
  })
})

describe("normalizePreferences", () => {
  it("returns safe defaults for an empty payload", () => {
    expect(normalizePreferences(null)).toEqual(DEFAULT_PREFERENCES)
    expect(normalizePreferences({})).toEqual(DEFAULT_PREFERENCES)
  })

  it("keeps valid values and repairs invalid ones", () => {
    const out = normalizePreferences({
      email: "a@b.co",
      emailReminders: false,
      dailyGoalMinutes: 900,
      tutorMode: "socratic",
      difficultyPreference: "advanced",
      reducedMotion: true,
      fontSize: 3,
      highContrast: true,
    })
    expect(out).toEqual({
      email: "a@b.co",
      emailReminders: false,
      dailyGoalMinutes: 240,
      tutorMode: "socratic",
      difficultyPreference: "advanced",
      reducedMotion: true,
      fontSize: 12,
      highContrast: true,
    })
    expect(normalizePreferences({ tutorMode: "invalid", difficultyPreference: "nope" })).toMatchObject({
      tutorMode: "direct",
      difficultyPreference: "adaptive",
    })
  })
})

describe("section diffs", () => {
  it("returns only changed fields in the requested section", () => {
    const draft = { ...prefs, dailyGoalMinutes: 90, emailReminders: false }
    expect(diffSectionPreferences(prefs, draft, "learning")).toEqual({ dailyGoalMinutes: 90 })
    expect(diffSectionPreferences(prefs, draft, "notifications")).toEqual({ emailReminders: false })
    expect(diffSectionPreferences(prefs, draft, "accessibility")).toEqual({})
  })

  it("detects dirty sections", () => {
    const draft = { ...prefs, fontSize: 18 }
    expect(isSectionDirty(prefs, draft, "accessibility")).toBe(true)
    expect(isSectionDirty(prefs, draft, "learning")).toBe(false)
    expect(isSectionDirty(null, draft, "accessibility")).toBe(false)
  })

  it("maps only preference-backed sections", () => {
    expect(isPreferenceSection("learning")).toBe(true)
    expect(isPreferenceSection("notifications")).toBe(true)
    expect(isPreferenceSection("accessibility")).toBe(true)
    expect(isPreferenceSection("appearance")).toBe(false)
    expect(isPreferenceSection("account")).toBe(false)
  })

  it("clamps numeric patches before they reach the API", () => {
    expect(sanitizeSectionPatch("learning", { dailyGoalMinutes: 0 })).toEqual({ dailyGoalMinutes: 15 })
    expect(sanitizeSectionPatch("learning", { dailyGoalMinutes: 999 })).toEqual({ dailyGoalMinutes: 240 })
    expect(sanitizeSectionPatch("accessibility", { fontSize: 99 })).toEqual({ fontSize: 20 })
    expect(sanitizeSectionPatch("accessibility", { reducedMotion: true })).toEqual({ reducedMotion: true })
    expect(sanitizeSectionPatch("notifications", { emailReminders: false })).toEqual({ emailReminders: false })
  })
})

describe("formatLastActive", () => {
  const now = Date.parse("2026-11-08T18:00:00Z")

  it("formats recent activity", () => {
    expect(formatLastActive(null, now)).toBe("Unknown")
    expect(formatLastActive(new Date(now - 20_000), now)).toBe("Just now")
    expect(formatLastActive(new Date(now - 5 * 60_000), now)).toBe("5m ago")
    expect(formatLastActive(new Date(now - 3 * 60 * 60_000), now)).toBe("3h ago")
    expect(formatLastActive(new Date(now - 2 * 24 * 60 * 60_000), now)).toBe("2d ago")
  })

  it("falls back to a date for older activity", () => {
    const out = formatLastActive(new Date(now - 40 * 24 * 60 * 60_000), now)
    expect(out).toMatch(/\d{4}/)
  })
})

describe("settings config", () => {
  it("has unique section ids and populates every group", () => {
    const ids = SETTINGS_SECTIONS.map((section) => section.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const group of SETTINGS_GROUPS) {
      expect(sectionsInGroup(group.id).length).toBeGreaterThan(0)
    }
  })

  it("normalizes known, legacy, and unknown tabs", () => {
    expect(normalizeSection("billing")).toBe("billing")
    expect(normalizeSection("security")).toBe("account")
    expect(normalizeSection(" Security ")).toBe("account")
    expect(normalizeSection(null)).toBe(DEFAULT_SETTINGS_SECTION)
    expect(normalizeSection("nope")).toBe(DEFAULT_SETTINGS_SECTION)
  })

  it("returns the requested section or the default", () => {
    expect(getSection("privacy").label).toBe("Privacy & data")
    expect(getSection("billing").group).toBe("data")
  })
})

describe("applyAccessibilityPrefs", () => {
  it("is a no-op without a document", () => {
    expect(() =>
      applyAccessibilityPrefs({ fontSize: 16, reducedMotion: false, highContrast: false })
    ).not.toThrow()
  })
})
