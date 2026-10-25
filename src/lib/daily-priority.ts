type ActionLesson = { id: string; title: string; estimatedMinutes?: number | null }
type ActionPhase = { id: string; title: string; lessons: ActionLesson[] }
type ActionRoadmap = { id: string; title: string; phases: ActionPhase[] }
type ActionProgress = Record<string, { completed?: boolean; passed?: boolean }>
type ActionReview = {
  lessonId: string
  roadmapId: string
  title: string
  topic: string
  overdueDays: number
}
type ActionWeakTopic = { topic: string; fail_count: number }

export type DailyAction =
  | { kind: "review"; title: string; detail: string; reason: string; href: string }
  | { kind: "practice"; title: string; detail: string; reason: string; href: string }
  | { kind: "phase"; title: string; detail: string; reason: string; href: string }
  | { kind: "lesson"; title: string; detail: string; reason: string; href: string }
  | { kind: "complete"; title: string; detail: string; reason: string; href: string }

export function chooseDailyAction(input: {
  roadmap: ActionRoadmap | null
  progress: ActionProgress
  reviews: ActionReview[]
  weakTopics: ActionWeakTopic[]
  phaseProgress: Record<string, { passed: boolean; attempts: number }>
  passThreshold: number
}): DailyAction {
  const review = input.reviews[0]
  if (review) {
    return {
      kind: "review",
      title: review.title,
      detail: `Review · ${review.topic}`,
      reason: review.overdueDays > 0
        ? `This review is ${review.overdueDays} ${review.overdueDays === 1 ? "day" : "days"} overdue; revisiting it helps strengthen retention.`
        : "This review is due today to help strengthen retention.",
      href: `/roadmap/${review.roadmapId}/lesson/${review.lessonId}`,
    }
  }

  const weakTopic = input.weakTopics[0]
  if (weakTopic) {
    return {
      kind: "practice",
      title: `Practice ${weakTopic.topic}`,
      detail: `Targeted practice · missed ${weakTopic.fail_count} ${weakTopic.fail_count === 1 ? "time" : "times"}`,
      reason: `You missed questions about ${weakTopic.topic}; focused practice can help close that gap.`,
      href: `/tutor?q=${encodeURIComponent(`Give me a short practice exercise about ${weakTopic.topic}. Ask one question at a time and explain my mistakes.`)}`,
    }
  }

  if (input.roadmap) {
    const lessons = input.roadmap.phases.flatMap((phase, phaseIndex) =>
      phase.lessons.map((lesson, index) => ({ ...lesson, phase: phase.title, phaseIndex, index }))
    )
    const next = lessons.find((lesson) => input.progress[lesson.id]?.passed !== true)
    if (!next) {
      return {
        kind: "complete",
        title: "Roadmap complete",
        detail: "You passed every lesson in this roadmap.",
        reason: "Keep your skills fresh with reviews or choose a new learning goal.",
        href: "/roadmap",
      }
    }

    const previousPhase = input.roadmap.phases[next.phaseIndex - 1]
    if (previousPhase && previousPhase.lessons.length > 0) {
      const previousPhaseComplete = previousPhase.lessons.every((lesson) => input.progress[lesson.id]?.passed === true)
      const previousExam = input.phaseProgress[previousPhase.id]
      if (
        previousPhaseComplete
        && previousExam?.passed !== true
        && (previousExam?.attempts ?? 0) < 2
      ) {
        return {
          kind: "phase",
          title: `Take the ${previousPhase.title} mastery quiz`,
          detail: `Phase checkpoint · before Week ${next.phaseIndex + 1}`,
          reason: "You passed every lesson in the previous phase. Pass its mastery quiz or make two attempts to unlock this week.",
          href: "/roadmap",
        }
      }
    }

    const retry = input.progress[next.id]?.completed === true
    const estimatedMinutes = next.estimatedMinutes ? ` · About ${next.estimatedMinutes} min` : ""
    return {
      kind: "lesson",
      title: next.title,
      detail: `${retry ? "Continue lesson" : "Next lesson"} · Week ${next.phaseIndex + 1}${estimatedMinutes}`,
      reason: retry
        ? `Continue this lesson and retry the quiz. Passing at ${input.passThreshold}% unlocks the next step.`
        : `This is next in ${input.roadmap.title}. Pass at ${input.passThreshold}% to unlock the following lesson.`,
      href: `/roadmap/${input.roadmap.id}/lesson/${next.id}`,
    }
  }

  return {
    kind: "lesson",
    title: "Create your learning roadmap",
    detail: "Start with a goal; HiPath will shape the first steps.",
    reason: "Your learning plan gives each lesson and review a clear purpose.",
    href: "/onboarding",
  }
}
