type ActionLesson = { id: string; title: string; estimatedMinutes?: number | null }
type ActionPhase = { id: string; title: string; lessons: ActionLesson[] }
type ActionRoadmap = { id: string; title: string; phases: ActionPhase[] }
type ActionProgress = Record<string, { completed?: boolean; passed?: boolean }>

export type NextLessonAction = {
  title: string
  detail: string
  reason: string
  href: string
}

export function chooseNextLesson(input: {
  roadmap: ActionRoadmap | null
  progress: ActionProgress
  phaseProgress: Record<string, { passed: boolean; attempts: number }>
  passThreshold: number
}): NextLessonAction {
  if (input.roadmap) {
    const lessons = input.roadmap.phases.flatMap((phase, phaseIndex) =>
      phase.lessons.map((lesson) => ({ ...lesson, phaseIndex }))
    )
    const next = lessons.find((lesson) => input.progress[lesson.id]?.passed !== true)
    if (!next) {
      return {
        title: "You’ve completed your roadmap",
        detail: "All lessons passed",
        reason: "Continue to your roadmap to review your progress or choose what to learn next.",
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
          title: next.title,
          detail: `Next lesson · Week ${next.phaseIndex + 1}`,
          reason: "Continue to your roadmap to complete the phase checkpoint and unlock this lesson.",
          href: "/roadmap",
        }
      }
    }

    const retry = input.progress[next.id]?.completed === true
    const estimatedMinutes = next.estimatedMinutes ? ` · About ${next.estimatedMinutes} min` : ""
    return {
      title: next.title,
      detail: `${retry ? "Continue lesson" : "Next lesson"} · Week ${next.phaseIndex + 1}${estimatedMinutes}`,
      reason: retry
        ? `Continue this lesson and retry the quiz. Passing at ${input.passThreshold}% unlocks the next step.`
        : `This is next in ${input.roadmap.title}. Pass at ${input.passThreshold}% to unlock the following lesson.`,
      href: `/roadmap/${input.roadmap.id}/lesson/${next.id}`,
    }
  }
  return {
    title: "Create your learning roadmap",
    detail: "Start with a goal",
    reason: "Create a personalized learning roadmap to find your next lesson.",
    href: "/onboarding",
  }
}
