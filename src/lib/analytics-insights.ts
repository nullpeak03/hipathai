import type { NextLessonAction } from "./daily-priority"
import { buildDaySeries, type DashboardDay } from "./dashboard"
import { progressToNextLevel } from "./gamification"
import type {
  ActivityDay,
  Gamification,
  LearningAnalytics,
  MasteryRecord,
  PhaseProgress,
  Progress,
  RoadmapData,
  WeakTopic,
} from "./store"
import { V2_MASTERY_THRESHOLD } from "./v2-mastery"

export const ANALYTICS_RANGES = [7, 30, 90] as const
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number]

export const ANALYTICS_RANGE_LABELS: Record<AnalyticsRange, string> = {
  7: "Last 7 days",
  30: "Last 30 days",
  90: "Last 90 days",
}

/** The API only returns 90 days, so a 90-day view has no prior window. */
const MAX_PREVIOUS_RANGE = 45

export type AnalyticsDay = DashboardDay & { xp: number }

/**
 * The shared dashboard day series omits XP, but analytics charts need it.
 * One lookup over the same activity rows keeps every range in UTC sync.
 */
export function buildAnalyticsDays(
  activity: ActivityDay[],
  count: number,
  now = new Date()
): AnalyticsDay[] {
  const xpByDate = new Map(activity.map((day) => [day.date, day.xp]))
  return buildDaySeries(activity, count, now).map((day) => ({
    ...day,
    xp: xpByDate.get(day.key) ?? 0,
  }))
}

export type PeriodTotals = {
  minutes: number
  xp: number
  lessons: number
  activeDays: number
}

export type RangeDelta = {
  minutes: number | null
  xp: number | null
  activeDays: number | null
}

export type RangeSummary = {
  range: AnalyticsRange
  days: AnalyticsDay[]
  minutes: number
  xp: number
  lessons: number
  activeDays: number
  consistency: number
  avgMinutesPerDay: number
  avgMinutesPerActiveDay: number
  bestDay: AnalyticsDay | null
  longestRun: number
  previous: PeriodTotals | null
  deltas: RangeDelta
}

function totalsOf(days: AnalyticsDay[]): PeriodTotals {
  return {
    minutes: days.reduce((total, day) => total + day.minutes, 0),
    xp: days.reduce((total, day) => total + day.xp, 0),
    lessons: days.reduce((total, day) => total + day.lessons, 0),
    activeDays: days.filter((day) => day.active).length,
  }
}

/** Percent change, or null when there is no baseline to compare against. */
export function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

/** Longest run of consecutive active days in a series. */
export function longestActiveRun(days: DashboardDay[]): number {
  let best = 0
  let run = 0
  for (const day of days) {
    if (day.active) {
      run += 1
      best = Math.max(best, run)
    } else {
      run = 0
    }
  }
  return best
}

export function summarizeRange(
  activity: ActivityDay[],
  range: AnalyticsRange,
  now = new Date()
): RangeSummary {
  const previousAvailable = range <= MAX_PREVIOUS_RANGE
  const days = buildAnalyticsDays(activity, range, now)
  const totals = totalsOf(days)
  const bestDay = days.reduce<AnalyticsDay | null>(
    (best, day) => (day.minutes > 0 && (!best || day.minutes > best.minutes) ? day : best),
    null
  )

  let previous: PeriodTotals | null = null
  if (previousAvailable) {
    const previousDays = buildAnalyticsDays(activity, range * 2, now).slice(0, range)
    previous = totalsOf(previousDays)
  }

  return {
    range,
    days,
    minutes: totals.minutes,
    xp: totals.xp,
    lessons: totals.lessons,
    activeDays: totals.activeDays,
    consistency: range > 0 ? Math.round((totals.activeDays / range) * 100) : 0,
    avgMinutesPerDay: Math.round(totals.minutes / range),
    avgMinutesPerActiveDay:
      totals.activeDays > 0 ? Math.round(totals.minutes / totals.activeDays) : 0,
    bestDay,
    longestRun: longestActiveRun(days),
    previous,
    deltas: {
      minutes: previous ? percentDelta(totals.minutes, previous.minutes) : null,
      xp: previous ? percentDelta(totals.xp, previous.xp) : null,
      activeDays: previous ? percentDelta(totals.activeDays, previous.activeDays) : null,
    },
  }
}

export type WeekComparison = {
  currentMinutes: number
  previousMinutes: number
  deltaPct: number | null
  currentActiveDays: number
  previousActiveDays: number
  currentDays: number
  previousDays: number
}

/**
 * Compares Monday-to-today with the same span last week. Both windows come
 * from the single 90-day activity fetch, so no extra request is needed.
 */
export function compareWeekToDate(activity: ActivityDay[], now = new Date()): WeekComparison {
  const series = buildDaySeries(activity, 14, now)
  const today = series[series.length - 1]
  const weekdayIndex = today ? new Date(`${today.key}T12:00:00.000Z`).getUTCDay() : 0
  const elapsed = Math.min(7, Math.max(1, ((weekdayIndex + 6) % 7) + 1))
  const current = series.slice(series.length - elapsed)
  const previous = series.slice(series.length - elapsed * 2, series.length - elapsed)
  const currentMinutes = current.reduce((total, day) => total + day.minutes, 0)
  const previousMinutes = previous.reduce((total, day) => total + day.minutes, 0)

  return {
    currentMinutes,
    previousMinutes,
    deltaPct: percentDelta(currentMinutes, previousMinutes),
    currentActiveDays: current.filter((day) => day.active).length,
    previousActiveDays: previous.filter((day) => day.active).length,
    currentDays: current.length,
    previousDays: previous.length,
  }
}

export type MasteryBand = "mastered" | "proficient" | "developing" | "needs-practice"

export type TopicMastery = {
  topic: string
  score: number
  attempts: number
  lastPracticedAt: string | null
  band: MasteryBand
}

export function masteryBand(score: number): MasteryBand {
  if (score >= V2_MASTERY_THRESHOLD) return "mastered"
  if (score >= 70) return "proficient"
  if (score >= 50) return "developing"
  return "needs-practice"
}

/** Collapses multiple lesson-level records into one score per topic. */
export function buildTopicMastery(records: MasteryRecord[]): TopicMastery[] {
  const grouped = new Map<
    string,
    { label: string; total: number; count: number; attempts: number; last: string | null }
  >()

  for (const record of records) {
    const topic = record.topic?.trim()
    if (!topic) continue
    const key = topic.toLowerCase()
    const existing = grouped.get(key) ?? {
      label: topic,
      total: 0,
      count: 0,
      attempts: 0,
      last: null,
    }
    const score = Number.isFinite(record.mastery_score) ? record.mastery_score : 0
    existing.total += score
    existing.count += 1
    existing.attempts += Math.max(0, record.attempts ?? 0)
    if (record.last_practiced_at && (!existing.last || record.last_practiced_at > existing.last)) {
      existing.last = record.last_practiced_at
    }
    grouped.set(key, existing)
  }

  return Array.from(grouped.values())
    .map((row) => {
      const score = Math.round(row.total / row.count)
      return {
        topic: row.label,
        score,
        attempts: row.attempts,
        lastPracticedAt: row.last,
        band: masteryBand(score),
      }
    })
    .sort((a, b) => a.score - b.score || a.topic.localeCompare(b.topic))
}

export type MasterySummary = {
  average: number
  total: number
  mastered: number
  hasData: boolean
  topics: TopicMastery[]
  bands: Record<MasteryBand, number>
  strongest: TopicMastery | null
  weakest: TopicMastery | null
}

export function summarizeMastery(
  records: MasteryRecord[],
  analytics: LearningAnalytics | null
): MasterySummary {
  const topics = buildTopicMastery(records)
  const bands: Record<MasteryBand, number> = {
    mastered: 0,
    proficient: 0,
    developing: 0,
    "needs-practice": 0,
  }
  for (const topic of topics) bands[topic.band] += 1

  if (topics.length > 0) {
    const average = Math.round(topics.reduce((total, topic) => total + topic.score, 0) / topics.length)
    return {
      average,
      total: topics.length,
      mastered: bands.mastered,
      hasData: true,
      topics,
      bands,
      strongest: topics.reduce((best, topic) => (topic.score > best.score ? topic : best), topics[0]),
      weakest: topics.reduce((worst, topic) => (topic.score < worst.score ? topic : worst), topics[0]),
    }
  }

  return {
    average: analytics?.average ?? 0,
    total: analytics?.total ?? 0,
    mastered: analytics?.mastered ?? 0,
    hasData: (analytics?.total ?? 0) > 0,
    topics,
    bands,
    strongest: null,
    weakest: null,
  }
}

export type WeakSkill = {
  topic: string
  score: number | null
  failCount: number
  severity: number
  reason: string
}

/**
 * Merges mastery scores, quiz-failure counts, and server-flagged low-mastery
 * topics into one ranked list. Topic matching is case-insensitive.
 */
export function rankWeakSkills(
  topics: TopicMastery[],
  weakTopics: WeakTopic[],
  lowMastery: string[]
): WeakSkill[] {
  const merged = new Map<
    string,
    { topic: string; score: number | null; failCount: number; flagged: boolean }
  >()

  const touch = (topic: string) => {
    const label = topic.trim()
    if (!label) return null
    const key = label.toLowerCase()
    const existing = merged.get(key)
    if (existing) return existing
    const created = { topic: label, score: null as number | null, failCount: 0, flagged: false }
    merged.set(key, created)
    return created
  }

  for (const topic of topics) {
    if (topic.score >= 70) continue
    const row = touch(topic.topic)
    if (!row) continue
    row.score = topic.score
    row.topic = topic.topic
  }

  for (const topic of weakTopics) {
    if ((topic.fail_count ?? 0) <= 0) continue
    const row = touch(topic.topic)
    if (!row) continue
    row.failCount = Math.max(row.failCount, topic.fail_count)
    row.topic = topic.topic
  }

  for (const topic of lowMastery) {
    const row = touch(topic)
    if (!row) continue
    row.flagged = true
    row.topic = topic.trim()
  }

  return Array.from(merged.values())
    .map((row) => {
      const scoreGap = row.score === null ? 20 : Math.max(0, 70 - row.score)
      const severity = scoreGap + row.failCount * 10 + (row.flagged ? 5 : 0)
      const reason =
        row.score !== null && row.score < 50
          ? "Mastery is below 50%"
          : row.failCount >= 2
            ? "Missed on multiple quizzes"
            : row.score !== null
              ? "Below mastery threshold"
              : "Flagged for extra practice"
      return { ...row, severity, reason }
    })
    .sort(
      (a, b) =>
        b.severity - a.severity ||
        (a.score ?? 101) - (b.score ?? 101) ||
        b.failCount - a.failCount ||
        a.topic.localeCompare(b.topic)
    )
}

export type InsightTone = "start" | "focus" | "build" | "celebrate"

export type CoachingInsight = {
  tone: InsightTone
  eyebrow: string
  headline: string
  detail: string
  cta: { label: string; href: string }
  secondary: { label: string; href: string } | null
  chips: { label: string; value: string }[]
}

export type InsightInput = {
  summary: RangeSummary
  gam: Gamification
  mastery: MasterySummary
  weakSkills: WeakSkill[]
  nextLesson: NextLessonAction
  hasRoadmap: boolean
}

function tutorHref(topic: string): string {
  return `/tutor?q=${encodeURIComponent(`Help me master: ${topic}`)}`
}

/**
 * Picks the one coaching message that matters most, in priority order:
 * get started, fix the weakest skill, build consistency, then celebrate.
 */
export function buildCoachingInsight({
  summary,
  gam,
  mastery,
  weakSkills,
  nextLesson,
  hasRoadmap,
}: InsightInput): CoachingInsight {
  const focus = weakSkills[0]
  const theoryHref = hasRoadmap ? "/roadmap" : "/onboarding"
  const chips = [
    { label: "Study time", value: formatMinutes(summary.minutes) },
    { label: "Active days", value: `${summary.activeDays}/${summary.range}` },
    focus
      ? { label: "Focus skill", value: focus.topic }
      : { label: "Avg mastery", value: `${mastery.average}%` },
  ]

  if (summary.minutes === 0 && summary.lessons === 0 && summary.xp === 0) {
    return {
      tone: "start",
      eyebrow: "Start here",
      headline: "Your first session sets the baseline",
      detail: hasRoadmap
        ? `Next up is ${nextLesson.title}. Finish one lesson and this report will start showing your real rhythm.`
        : "Create a roadmap, finish one lesson, and this page will turn your activity into coaching.",
      cta: hasRoadmap
        ? { label: "Start next lesson", href: nextLesson.href }
        : { label: "Create your roadmap", href: "/onboarding" },
      secondary: null,
      chips,
    }
  }

  if (focus && ((focus.score !== null && focus.score < 50) || focus.failCount >= 2)) {
    return {
      tone: "focus",
      eyebrow: "Biggest lever",
      headline: `${focus.topic} is holding your progress back`,
      detail:
        focus.score !== null
          ? `${focus.topic} is at ${focus.score}% mastery${focus.failCount > 0 ? ` after ${focus.failCount} missed quiz${focus.failCount === 1 ? "" : "zes"}` : ""}. One focused tutor session will do more for your average than another new lesson.`
          : `You have missed ${focus.failCount} quiz${focus.failCount === 1 ? "" : "zes"} on ${focus.topic}. A short tutor session will close the gap before it compounds.`,
      cta: { label: `Practice ${focus.topic}`, href: tutorHref(focus.topic) },
      secondary: { label: "Continue roadmap", href: nextLesson.href },
      chips,
    }
  }

  if (summary.consistency < 40 && summary.activeDays > 0) {
    return {
      tone: "build",
      eyebrow: "Consistency",
      headline: "A steadier rhythm will move every metric",
      detail: `You studied on ${summary.activeDays} of the last ${summary.range} days (${summary.consistency}%). Short, regular sessions beat occasional long ones for retention.`,
      cta: { label: "Plan today's session", href: nextLesson.href },
      secondary: { label: "Open roadmap", href: theoryHref },
      chips,
    }
  }

  if ((summary.deltas.minutes ?? 0) >= 15 || gam.streak >= 3) {
    const delta = summary.deltas.minutes
    return {
      tone: "celebrate",
      eyebrow: "Momentum",
      headline:
        gam.streak >= 3
          ? `${gam.streak}-day streak — momentum is compounding`
          : `Study time is up ${delta}%`,
      detail:
        gam.streak >= 3
          ? `You have shown up ${gam.streak} days in a row and logged ${formatMinutes(summary.minutes)} across ${summary.activeDays} active days. Protect the streak with one focused session today.`
          : `You logged ${formatMinutes(summary.minutes)} this period, up ${delta}% on the previous one. Keep the next session short and specific.`,
      cta: { label: "Continue next lesson", href: nextLesson.href },
      secondary: focus ? { label: `Practice ${focus.topic}`, href: tutorHref(focus.topic) } : null,
      chips,
    }
  }

  if (mastery.hasData && mastery.average >= 80) {
    return {
      tone: "celebrate",
      eyebrow: "Mastery",
      headline: "You are within reach of mastery across the board",
      detail: `Average mastery is ${mastery.average}% with ${mastery.mastered} of ${mastery.total} topics already mastered. Focus on the last few gaps instead of adding new material.`,
      cta: focus
        ? { label: `Practice ${focus.topic}`, href: tutorHref(focus.topic) }
        : { label: "Continue next lesson", href: nextLesson.href },
      secondary: { label: "Open roadmap", href: theoryHref },
      chips,
    }
  }

  return {
    tone: "build",
    eyebrow: "Next step",
    headline: "Turn your practice into retention",
    detail: `You logged ${formatMinutes(summary.minutes)} across ${summary.activeDays} days. Keep sessions short, revisit weak topics, and let the mastery score guide what comes next.`,
    cta: focus
      ? { label: `Practice ${focus.topic}`, href: tutorHref(focus.topic) }
      : { label: "Continue next lesson", href: nextLesson.href },
    secondary: { label: "Open roadmap", href: theoryHref },
    chips,
  }
}

export type XpSummary = {
  level: number
  nextThreshold: number
  progress: number
  remainingToNext: number
  xpInRange: number
  xpPerActiveDay: number
}

export function summarizeXp(gam: Gamification, days: AnalyticsDay[]): XpSummary {
  const level = progressToNextLevel(gam.xp)
  const xpInRange = days.reduce((total, day) => total + day.xp, 0)
  const activeDays = days.filter((day) => day.active).length
  return {
    ...level,
    remainingToNext: Math.max(0, level.nextThreshold - gam.xp),
    xpInRange,
    xpPerActiveDay: activeDays > 0 ? Math.round(xpInRange / activeDays) : 0,
  }
}

export type RoadmapSummary = {
  hasRoadmap: boolean
  title: string
  pct: number
  done: number
  total: number
  remaining: number
  currentPhaseTitle: string | null
  phaseIndex: number
  phasePct: number
  phaseLessons: number
  phasePassed: number
  lessonsLeftInPhase: number
  checkpointReady: boolean
}

export function summarizeRoadmap(
  roadmap: RoadmapData | null,
  progress: Progress,
  phaseProgress: PhaseProgress
): RoadmapSummary {
  if (!roadmap) {
    return {
      hasRoadmap: false,
      title: "",
      pct: 0,
      done: 0,
      total: 0,
      remaining: 0,
      currentPhaseTitle: null,
      phaseIndex: 0,
      phasePct: 0,
      phaseLessons: 0,
      phasePassed: 0,
      lessonsLeftInPhase: 0,
      checkpointReady: false,
    }
  }

  const allLessons = roadmap.phases.flatMap((phase) => phase.lessons)
  const total = allLessons.length || roadmap.totalLessons
  const done = allLessons.filter((lesson) => progress[lesson.id]?.completed).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const currentPhase =
    roadmap.phases.find((phase) =>
      phase.lessons.some((lesson) => progress[lesson.id]?.passed !== true)
    ) ?? roadmap.phases[roadmap.phases.length - 1]
  const phaseLessons = currentPhase?.lessons ?? []
  const phasePassed = phaseLessons.filter((lesson) => progress[lesson.id]?.passed).length
  const phasePct = phaseLessons.length > 0 ? Math.round((phasePassed / phaseLessons.length) * 100) : 0
  const phaseIndex = currentPhase
    ? roadmap.phases.findIndex((phase) => phase.id === currentPhase.id) + 1
    : 0

  return {
    hasRoadmap: true,
    title: roadmap.title,
    pct,
    done,
    total,
    remaining: Math.max(0, total - done),
    currentPhaseTitle: currentPhase?.title ?? null,
    phaseIndex,
    phasePct,
    phaseLessons: phaseLessons.length,
    phasePassed,
    lessonsLeftInPhase: Math.max(0, phaseLessons.length - phasePassed),
    checkpointReady:
      phaseLessons.length > 0 &&
      phasePct === 100 &&
      currentPhase !== undefined &&
      phaseProgress[currentPhase.id]?.passed !== true,
  }
}

export function formatMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes))
  if (safe < 60) return `${safe}m`
  const hours = Math.floor(safe / 60)
  const rest = safe % 60
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`
}
