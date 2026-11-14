// Generation health from `async_jobs` rows.
//
// The 13-day lesson outage and a 4,120-second job were both discovered by a
// human noticing slow UX. These pure helpers turn the job table into a small
// health snapshot and a list of alert reasons; the sweep cron emails them.
//
// Kept free of I/O so the thresholds and percentile maths are unit-tested.

export type JobKind = "roadmap" | "lesson" | "quiz" | "other"

export type JobRow = {
  id: string
  status: string
  started_at?: string | null
  completed_at?: string | null
  result?: Record<string, unknown> | null
}

export type JobHealth = {
  kind: JobKind
  total: number
  completed: number
  failed: number
  failureRate: number
  /** Completed jobs whose `result.missingParts` is non-empty. */
  partial: number
  partialRate: number
  p95DurationMs: number | null
}

export type JobHealthSummary = {
  windowMs: number
  overall: Omit<JobHealth, "kind">
  byKind: JobHealth[]
}

export const JOB_HEALTH_WINDOW_MS = 60 * 60 * 1000

export const JOB_HEALTH_THRESHOLDS = {
  /** Below this many terminal jobs a rate is noise, not a signal. */
  minSample: 5,
  maxFailureRate: 0.1,
  maxP95DurationMs: 15 * 60 * 1000,
  /** Lessons are allowed to ship partial, but not silently at scale. */
  maxPartialRate: 0.2,
} as const

export type JobHealthThresholds = typeof JOB_HEALTH_THRESHOLDS

/**
 * Identify the job from its `result` payload. Order matters: quiz jobs also
 * carry `lessonId`.
 *
 * Older roadmap rows only have `{ totalPhases }` (written before the job id
 * was added to the payload), so phase counters count as roadmap too —
 * otherwise real failures would fall into `other` and never alert.
 */
export function jobKind(result: unknown): JobKind {
  if (!result || typeof result !== "object" || Array.isArray(result)) return "other"
  const r = result as Record<string, unknown>
  if (typeof r.quizCount === "number") return "quiz"
  if (typeof r.lessonId === "string") return "lesson"
  if (
    typeof r.roadmapId === "string" ||
    typeof r.totalPhases === "number" ||
    typeof r.completedPhases === "number"
  ) {
    return "roadmap"
  }
  return "other"
}

/** Duration preference: explicit telemetry, else the DB timestamps. */
export function jobDurationMs(row: JobRow): number | null {
  const explicit = row.result?.durationMs
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit >= 0) {
    return explicit
  }
  if (!row.started_at || !row.completed_at) return null
  const start = Date.parse(row.started_at)
  const end = Date.parse(row.completed_at)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  return end - start
}

export function isPartialJob(row: JobRow): boolean {
  const missing = row.result?.missingParts
  return Array.isArray(missing) && missing.length > 0
}

/** Nearest-rank p95; null when there is nothing to measure. */
export function percentile95(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil(0.95 * sorted.length) - 1
  return sorted[Math.min(Math.max(rank, 0), sorted.length - 1)] ?? null
}

function bucket(kind: JobKind, rows: JobRow[]): JobHealth {
  const completed = rows.filter((r) => r.status === "completed").length
  const failed = rows.filter((r) => r.status === "failed").length
  const total = completed + failed
  const durations = rows
    .map(jobDurationMs)
    .filter((d): d is number => d !== null)
  const partial = rows.filter((r) => r.status === "completed" && isPartialJob(r)).length

  return {
    kind,
    total,
    completed,
    failed,
    failureRate: total === 0 ? 0 : failed / total,
    partial,
    partialRate: completed === 0 ? 0 : partial / completed,
    p95DurationMs: percentile95(durations),
  }
}

/**
 * Summarize terminal jobs (completed/failed). `processing` rows are excluded:
 * the sweep already accounts for stuck ones separately.
 */
export function summarizeJobs(rows: JobRow[], windowMs: number = JOB_HEALTH_WINDOW_MS): JobHealthSummary {
  const terminal = rows.filter((r) => r.status === "completed" || r.status === "failed")
  const overall = bucket("other", terminal)
  return {
    windowMs,
    overall: {
      total: overall.total,
      completed: overall.completed,
      failed: overall.failed,
      failureRate: overall.failureRate,
      partial: overall.partial,
      partialRate: overall.partialRate,
      p95DurationMs: overall.p95DurationMs,
    },
    byKind: [
      bucket("roadmap", terminal.filter((r) => jobKind(r.result) === "roadmap")),
      bucket("lesson", terminal.filter((r) => jobKind(r.result) === "lesson")),
      bucket("quiz", terminal.filter((r) => jobKind(r.result) === "quiz")),
      bucket("other", terminal.filter((r) => jobKind(r.result) === "other")),
    ],
  }
}

function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

function minutes(ms: number): string {
  return `${(ms / 60_000).toFixed(1)} min`
}

/**
 * Return human-readable alert reasons for degraded generation. An empty array
 * means healthy. Each reason is one line, suitable for the admin email body.
 */
export function evaluateJobHealth(
  summary: JobHealthSummary,
  thresholds: JobHealthThresholds = JOB_HEALTH_THRESHOLDS
): string[] {
  const reasons: string[] = []
  for (const health of summary.byKind) {
    if (health.total < thresholds.minSample) continue
    const label = health.kind === "other" ? "unclassified" : health.kind

    if (health.failureRate > thresholds.maxFailureRate) {
      reasons.push(
        `${label}: ${health.failed}/${health.total} jobs failed in the last hour (${percent(health.failureRate)})`
      )
    }
    if (health.p95DurationMs !== null && health.p95DurationMs > thresholds.maxP95DurationMs) {
      reasons.push(
        `${label}: p95 duration ${minutes(health.p95DurationMs)} exceeds ${minutes(thresholds.maxP95DurationMs)}`
      )
    }
    if (health.kind === "lesson" && health.partialRate > thresholds.maxPartialRate) {
      reasons.push(
        `${label}: ${health.partial}/${health.completed} completed lessons are missing sections (${percent(health.partialRate)})`
      )
    }
  }
  return reasons
}
