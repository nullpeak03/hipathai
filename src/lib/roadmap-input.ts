// Input validation for roadmap generation requests. Both the sync route and
// the async route (and any future caller) parse the request through this
// function, so validation cannot drift between entry points.
//
// Bounds are deliberately conservative and also enforced in
// `planRoadmapSize` (defense in depth for replays and older clients).

import {
  MAX_DURATION_DAYS,
  MIN_DURATION_DAYS,
  parseDurationToDays,
  parseTimeToMinutes,
} from "./roadmap-sizing"

export const MIN_TIME_MINS = 15
export const MAX_TIME_MINS = 8 * 60
export const MAX_GOAL_CHARS = 120
export const MAX_FIELD_CHARS = 80

export type RoadmapInput = {
  goal: string
  level: string
  time: string
  duration: string
  why: string
  style: string
  timeMins: number
  durationDays: number
}

export type RoadmapInputResult =
  | { ok: true; value: RoadmapInput }
  | { ok: false; error: string }

const DEFAULTS = {
  goal: "AI Agent Developer",
  level: "Beginner",
  time: "1 hr",
  duration: "8 weeks",
  why: "To build career",
  style: "structured",
} as const

/** Read a trimmed optional string, rejecting wrong types and overlong values. */
function optionalString(
  value: unknown,
  fallback: string,
  maxChars: number
): string | null {
  if (value === undefined || value === null) return fallback
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return fallback
  if (trimmed.length > maxChars) return null
  return trimmed
}

/**
 * Validate and normalize a roadmap request body.
 *
 * Users type custom time/duration strings, so we parse them and check the
 * *parsed* value: "100000 years", "2 years", "0 days", and "banana" are all
 * rejected with a message the UI can show. Missing fields keep the historical
 * defaults, so existing clients keep working.
 */
export function validateRoadmapInput(body: unknown): RoadmapInputResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request." }
  }
  const raw = body as Record<string, unknown>

  const goal = optionalString(raw.goal, DEFAULTS.goal, MAX_GOAL_CHARS)
  if (goal === null) {
    return { ok: false, error: `Goal must be text up to ${MAX_GOAL_CHARS} characters.` }
  }
  if (goal.length < 3) {
    return { ok: false, error: "Please enter a goal with at least 3 characters." }
  }

  const level = optionalString(raw.level, DEFAULTS.level, MAX_FIELD_CHARS)
  const time = optionalString(raw.time, DEFAULTS.time, MAX_FIELD_CHARS)
  const duration = optionalString(raw.duration, DEFAULTS.duration, MAX_FIELD_CHARS)
  const why = optionalString(raw.why, DEFAULTS.why, MAX_GOAL_CHARS)
  const style = optionalString(raw.style, DEFAULTS.style, MAX_FIELD_CHARS)
  if (!level || !time || !duration || !why || !style) {
    return { ok: false, error: "One or more fields are invalid or too long." }
  }

  // Require a number in the raw string: the parsers fall back to a default for
  // unparseable text, which would silently accept "banana" as 60 minutes.
  if (!/\d/.test(time)) {
    return { ok: false, error: "Daily study time must include a number, e.g. 45 min or 2 hrs." }
  }
  if (!/\d/.test(duration)) {
    return { ok: false, error: "Plan length must include a number, e.g. 8 weeks or 3 months." }
  }

  const timeMins = parseTimeToMinutes(time)
  if (timeMins < MIN_TIME_MINS || timeMins > MAX_TIME_MINS) {
    return {
      ok: false,
      error: "Daily study time must be between 15 minutes and 8 hours.",
    }
  }

  const durationDays = parseDurationToDays(duration)
  if (durationDays < MIN_DURATION_DAYS || durationDays > MAX_DURATION_DAYS) {
    return {
      ok: false,
      error: "Plan length must be between 1 week and 1 year.",
    }
  }

  return {
    ok: true,
    value: { goal, level, time, duration, why, style, timeMins, durationDays },
  }
}
