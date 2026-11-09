import type { Lesson } from "./mockData"

/**
 * Pure roadmap-progress helpers shared by the Roadmap page and its tests.
 * These intentionally mirror the server's progression rules so the UI never
 * advertises a lesson as unlocked before the same gate allows it.
 */

export type LessonShape = Pick<Lesson, "id" | "estimatedMinutes" | "prerequisites"> & { title?: string }
export type PhaseShape = { id: string; lessons: LessonShape[] }
export type ProgressShape = Record<string, { completed?: boolean; passed?: boolean; score?: number }>
export type PhaseProgressShape = Record<string, { passed?: boolean; attempts?: number; score?: number | null }>

export type NextLesson = {
  phaseIndex: number
  lessonIndex: number
  lesson: LessonShape
}

export type CheckpointStatus = "locked" | "ready" | "retry" | "remedial" | "passed"

export const DEFAULT_LESSON_MINUTES = 20

export function isLessonPassed(progress: ProgressShape, lessonId: string): boolean {
  return progress[lessonId]?.passed === true
}

export function phaseLessonsPassed(phase: PhaseShape, progress: ProgressShape): number {
  return phase.lessons.filter((lesson) => isLessonPassed(progress, lesson.id)).length
}

export function isPhaseLessonsComplete(phase: PhaseShape, progress: ProgressShape): boolean {
  return phase.lessons.length > 0 && phaseLessonsPassed(phase, progress) === phase.lessons.length
}

export function countPassedLessons(phases: PhaseShape[], progress: ProgressShape): number {
  return phases.reduce((total, phase) => total + phaseLessonsPassed(phase, progress), 0)
}

/**
 * A phase checkpoint stops blocking the next phase after a pass, or after two
 * failed attempts (the documented remedial path). Completion still requires a
 * pass — this helper only answers "can the learner move on?".
 */
export function checkpointUnlocksNextPhase(phaseId: string, phaseProgress: PhaseProgressShape): boolean {
  const entry = phaseProgress[phaseId]
  return entry?.passed === true || (entry?.attempts ?? 0) >= 2
}

export function findNextLesson(phases: PhaseShape[], progress: ProgressShape): NextLesson | null {
  for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex += 1) {
    const phase = phases[phaseIndex]
    for (let lessonIndex = 0; lessonIndex < phase.lessons.length; lessonIndex += 1) {
      const lesson = phase.lessons[lessonIndex]
      if (!isLessonPassed(progress, lesson.id)) return { phaseIndex, lessonIndex, lesson }
    }
  }
  return null
}

export function isLessonLocked(
  phases: PhaseShape[],
  phaseIndex: number,
  lessonIndex: number,
  progress: ProgressShape,
  phaseProgress: PhaseProgressShape
): boolean {
  const phase = phases[phaseIndex]
  const lesson = phase?.lessons[lessonIndex]
  if (!lesson) return false

  // Phase gate: the previous phase must be finished, and its checkpoint must
  // be passed or have reached the two-attempt remedial unlock.
  if (phaseIndex > 0) {
    const previousPhase = phases[phaseIndex - 1]
    if (
      isPhaseLessonsComplete(previousPhase, progress)
      && !checkpointUnlocksNextPhase(previousPhase.id, phaseProgress)
    ) {
      return true
    }
  }

  // Optional DAG prerequisites override linear order. An empty array means
  // "no prerequisites", not "explicitly independent", so it must not skip the
  // sequential gate below.
  if (lesson.prerequisites && lesson.prerequisites.length > 0) {
    return !lesson.prerequisites.every((id) => isLessonPassed(progress, id))
  }

  const isFirstOverall = phaseIndex === 0 && lessonIndex === 0
  if (isFirstOverall) return false

  const previousLesson =
    lessonIndex > 0
      ? phase.lessons[lessonIndex - 1]
      : phases[phaseIndex - 1]?.lessons[phases[phaseIndex - 1].lessons.length - 1]
  if (!previousLesson) return false

  return !isLessonPassed(progress, previousLesson.id)
}

/**
 * The phase the learner should focus on: the phase holding the next readable
 * lesson, or — when every lesson is passed — the first phase still missing its
 * checkpoint pass. Returns -1 when the whole roadmap is finished.
 */
export function getFocusPhaseIndex(
  phases: PhaseShape[],
  progress: ProgressShape,
  phaseProgress: PhaseProgressShape
): number {
  const next = findNextLesson(phases, progress)
  if (next) {
    if (next.phaseIndex > 0) {
      const previousPhase = phases[next.phaseIndex - 1]
      if (
        isPhaseLessonsComplete(previousPhase, progress)
        && !checkpointUnlocksNextPhase(previousPhase.id, phaseProgress)
      ) {
        return next.phaseIndex - 1
      }
    }
    return next.phaseIndex
  }

  return phases.findIndex((phase) => !phaseProgress[phase.id]?.passed)
}

export function getCheckpointStatus(
  phase: PhaseShape,
  progress: ProgressShape,
  phaseProgress: PhaseProgressShape
): CheckpointStatus {
  const entry = phaseProgress[phase.id]
  if (entry?.passed === true) return "passed"
  if (!isPhaseLessonsComplete(phase, progress)) return "locked"
  if ((entry?.attempts ?? 0) >= 2) return "remedial"
  if ((entry?.attempts ?? 0) > 0) return "retry"
  return "ready"
}

export function estimateRemainingMinutes(
  phases: PhaseShape[],
  progress: ProgressShape,
  fallbackMinutes = DEFAULT_LESSON_MINUTES
): number {
  return phases.reduce((total, phase) => {
    return (
      total +
      phase.lessons.reduce((phaseTotal, lesson) => {
        if (isLessonPassed(progress, lesson.id)) return phaseTotal
        const estimate = lesson.estimatedMinutes
        const minutes =
          typeof estimate === "number" && Number.isFinite(estimate) && estimate > 0
            ? estimate
            : fallbackMinutes
        return phaseTotal + minutes
      }, 0)
    )
  }, 0)
}

export function formatDuration(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes))
  const hours = Math.floor(rounded / 60)
  const remainder = rounded % 60
  if (hours === 0) return `${remainder} min`
  if (remainder === 0) return `${hours}h`
  return `${hours}h ${remainder}m`
}
