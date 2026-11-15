// Classifies async job results so the status endpoint can complete every
// job kind. Roadmap jobs carry {roadmapId}; lesson-content and quiz jobs
// carry {lessonId} (quiz adds quizCount). Before this, the status route
// treated every completed job as a roadmap id — lesson/quiz completions
// 404'd, clients polled until timeout, and results only appeared on refresh.

export type JobResultKind = "roadmap" | "lesson" | "unknown"

export function describeJobResult(result: unknown): {
  kind: JobResultKind
  lessonId?: string
  quizCount?: number
} {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return { kind: "unknown" }
  }
  const r = result as Record<string, unknown>
  if (typeof r.lessonId === "string" && r.lessonId.length > 0) {
    return {
      kind: "lesson",
      lessonId: r.lessonId,
      ...(typeof r.quizCount === "number" ? { quizCount: r.quizCount } : {}),
    }
  }
  if (typeof r.roadmapId === "string" && r.roadmapId.length > 0) {
    return { kind: "roadmap" }
  }
  return { kind: "unknown" }
}

/**
 * How to find the owner of a job row.
 *
 * `user_id` is authoritative when present (written at creation since
 * migration 028). Legacy rows predate it, so fall back to the content the job
 * produced: a lesson/quiz job points at a lesson, a roadmap job's id IS the
 * roadmap id, and older roadmap rows only carry phase counters.
 */
export type JobOwnerLookup =
  | { via: "job" }
  | { via: "lesson"; lessonId: string }
  | { via: "roadmap"; roadmapId: string }

export function jobOwnerLookup(
  job: { user_id?: unknown; result?: unknown },
  jobId: string
): JobOwnerLookup {
  if (typeof job.user_id === "string" && job.user_id.length > 0) return { via: "job" }
  const described = describeJobResult(job.result)
  if (described.kind === "lesson" && described.lessonId) {
    return { via: "lesson", lessonId: described.lessonId }
  }
  return { via: "roadmap", roadmapId: jobId }
}
