import type { SettingsSectionId } from "./settings.config"

export type TutorMode = "direct" | "socratic"
export type DifficultyPreference = "adaptive" | "beginner" | "intermediate" | "advanced"

export type Preferences = {
  email: string | null
  emailReminders: boolean
  dailyGoalMinutes: number
  tutorMode: TutorMode
  difficultyPreference: DifficultyPreference
  reducedMotion: boolean
  fontSize: number
  highContrast: boolean
}

export const PREFERENCE_SECTIONS = {
  learning: ["dailyGoalMinutes", "tutorMode", "difficultyPreference"],
  notifications: ["emailReminders"],
  accessibility: ["reducedMotion", "fontSize", "highContrast"],
} as const satisfies Record<string, readonly (keyof Preferences)[]>

export type PreferenceSectionId = keyof typeof PREFERENCE_SECTIONS

export const PREFERENCE_SECTION_IDS = Object.keys(PREFERENCE_SECTIONS) as PreferenceSectionId[]

export const TUTOR_MODES: { value: TutorMode; label: string; description: string }[] = [
  { value: "direct", label: "Direct", description: "Clear answers with the reasoning spelled out." },
  { value: "socratic", label: "Socratic", description: "Guiding questions that make you find the answer." },
]

export const DIFFICULTY_OPTIONS: { value: DifficultyPreference; label: string; description: string }[] = [
  { value: "adaptive", label: "Adaptive", description: "Matches difficulty to your recent performance." },
  { value: "beginner", label: "Beginner", description: "More scaffolding and gentler quizzes." },
  { value: "intermediate", label: "Intermediate", description: "Balanced explanations and challenge." },
  { value: "advanced", label: "Advanced", description: "Terser hints and harder practice." },
]

export const DAILY_GOAL_MIN = 15
export const DAILY_GOAL_MAX = 240
export const FONT_SIZE_MIN = 12
export const FONT_SIZE_MAX = 20

export const DEFAULT_PREFERENCES: Preferences = {
  email: null,
  emailReminders: true,
  dailyGoalMinutes: 60,
  tutorMode: "direct",
  difficultyPreference: "adaptive",
  reducedMotion: false,
  fontSize: 16,
  highContrast: false,
}

export function clampDailyGoal(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PREFERENCES.dailyGoalMinutes
  return Math.max(DAILY_GOAL_MIN, Math.min(DAILY_GOAL_MAX, Math.round(value)))
}

export function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PREFERENCES.fontSize
  return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, Math.round(value)))
}

export function isPreferenceSection(id: SettingsSectionId): id is PreferenceSectionId {
  return (PREFERENCE_SECTION_IDS as string[]).includes(id)
}

/** Normalize the untyped JSON from the preferences endpoint. */
export function normalizePreferences(input: unknown): Preferences {
  const raw = (input ?? {}) as Record<string, unknown>
  const tutorMode: TutorMode = raw.tutorMode === "socratic" ? "socratic" : "direct"
  const difficulty = raw.difficultyPreference
  const difficultyPreference: DifficultyPreference =
    difficulty === "beginner" || difficulty === "intermediate" || difficulty === "advanced"
      ? difficulty
      : "adaptive"

  return {
    email: typeof raw.email === "string" && raw.email.length > 0 ? raw.email : null,
    emailReminders: typeof raw.emailReminders === "boolean" ? raw.emailReminders : DEFAULT_PREFERENCES.emailReminders,
    dailyGoalMinutes:
      typeof raw.dailyGoalMinutes === "number" ? clampDailyGoal(raw.dailyGoalMinutes) : DEFAULT_PREFERENCES.dailyGoalMinutes,
    tutorMode,
    difficultyPreference,
    reducedMotion: typeof raw.reducedMotion === "boolean" ? raw.reducedMotion : DEFAULT_PREFERENCES.reducedMotion,
    fontSize: typeof raw.fontSize === "number" ? clampFontSize(raw.fontSize) : DEFAULT_PREFERENCES.fontSize,
    highContrast: typeof raw.highContrast === "boolean" ? raw.highContrast : DEFAULT_PREFERENCES.highContrast,
  }
}

export function sectionFields(section: PreferenceSectionId): readonly (keyof Preferences)[] {
  return PREFERENCE_SECTIONS[section]
}

/** Only the changed fields in a section, ready to PATCH. */
export function diffSectionPreferences(
  baseline: Preferences,
  draft: Preferences,
  section: PreferenceSectionId
): Partial<Preferences> {
  const patch: Partial<Preferences> = {}
  for (const field of sectionFields(section)) {
    if (baseline[field] !== draft[field]) {
      Object.assign(patch, { [field]: draft[field] })
    }
  }
  return patch
}

export function isSectionDirty(
  baseline: Preferences | null,
  draft: Preferences | null,
  section: PreferenceSectionId
): boolean {
  if (!baseline || !draft) return false
  return Object.keys(diffSectionPreferences(baseline, draft, section)).length > 0
}

/** Clamp numeric fields so the optimistic baseline matches the API's stored value. */
export function sanitizeSectionPatch(
  section: PreferenceSectionId,
  patch: Partial<Preferences>
): Partial<Preferences> {
  const next = { ...patch }
  if (section === "learning" && typeof next.dailyGoalMinutes === "number") {
    next.dailyGoalMinutes = clampDailyGoal(next.dailyGoalMinutes)
  }
  if (section === "accessibility" && typeof next.fontSize === "number") {
    next.fontSize = clampFontSize(next.fontSize)
  }
  return next
}

/**
 * Apply accessibility preferences to the document. Used for the live preview
 * while editing and to restore the saved state after save/discard.
 */
export function applyAccessibilityPrefs(
  prefs: Pick<Preferences, "fontSize" | "reducedMotion" | "highContrast">
): void {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.style.fontSize = `${clampFontSize(prefs.fontSize)}px`
  root.classList.toggle("reduce-motion", prefs.reducedMotion === true)
  root.classList.toggle("high-contrast", prefs.highContrast === true)
  try {
    localStorage.setItem("hipath_font_size", String(clampFontSize(prefs.fontSize)))
    localStorage.setItem("hipath_reduced_motion", prefs.reducedMotion ? "1" : "0")
    localStorage.setItem("hipath_high_contrast", prefs.highContrast ? "1" : "0")
  } catch {
    // storage can be unavailable in private mode; the DOM still updates
  }
}

/** Human-friendly relative time for the sessions list. */
export function formatLastActive(date: Date | string | number | null | undefined, now = Date.now()): string {
  if (!date) return "Unknown"
  const then = date instanceof Date ? date.getTime() : new Date(date).getTime()
  if (!Number.isFinite(then)) return "Unknown"
  const diff = Math.max(0, now - then)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return "Just now"
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}
