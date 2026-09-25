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
