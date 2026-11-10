"use client"

import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Loader2,
  Lock,
  RotateCcw,
  Sparkles,
  Trophy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { IconBadge } from "@/components/ui/icon-badge"
import type { Lesson, Phase } from "@/lib/mockData"
import {
  getCheckpointStatus,
  isPhaseLessonsComplete,
  phaseLessonsPassed,
  type CheckpointStatus,
} from "@/lib/roadmap-progress"
import type { PhaseProgress, Progress } from "@/lib/store"
import { PHASE_EXAM_PASS_THRESHOLD } from "@/lib/v2-mastery"
import { cn } from "@/lib/utils"

export type PhaseState = "done" | "current" | "open" | "todo"

type PhaseCardProps = {
  roadmapId: string
  phase: Phase
  index: number
  totalPhases: number
  state: PhaseState
  progress: Progress
  phaseProgress: PhaseProgress
  open: boolean
  onToggle: () => void
  viewMode: "grid" | "list"
  isLocked: (lesson: Lesson, lessonIndex: number) => boolean
  examLoaded: boolean
  examSubmitted: boolean
  examPassed: boolean
  examScore: number | null
  examAnswered: number
  examQuestionCount: number
  examBusy: boolean
  onStartCheckpoint: () => void
  onOpenCheckpoint: () => void
}

const STATE_STYLES: Record<PhaseState, { box: string; badge: string; label: string }> = {
  done: {
    box: "bg-ok-bg text-ok-fg",
    badge: "border-ok-border bg-ok-bg text-ok-fg",
    label: "Complete",
  },
  current: {
    box: "bg-primary text-primary-foreground",
    badge: "border-info-border bg-info-bg text-info-fg",
    label: "In progress",
  },
  open: {
    box: "border border-warn-border bg-warn-bg text-warn-fg",
    badge: "border-warn-border bg-warn-bg text-warn-fg",
    label: "Checkpoint open",
  },
  todo: {
    box: "bg-muted text-muted-foreground",
    badge: "border-border bg-muted text-muted-foreground",
    label: "Upcoming",
  },
}

function headerCheckpointCopy(
  status: CheckpointStatus,
  remainingLessons: number,
  score: number | null
): string {
  switch (status) {
    case "passed":
      return score !== null ? `Checkpoint passed · ${score}%` : "Checkpoint passed"
    case "ready":
      return "Checkpoint ready"
    case "retry":
      return score !== null ? `Checkpoint not passed · ${score}%` : "Checkpoint not passed"
    case "remedial":
      return "Checkpoint open · next phase unlocked"
    default:
      return remainingLessons > 0
        ? `${remainingLessons} lesson${remainingLessons === 1 ? "" : "s"} until checkpoint`
        : "Checkpoint locked"
  }
}

export function PhaseCard({
  roadmapId,
  phase,
  index,
  totalPhases,
  state,
  progress,
  phaseProgress,
  open,
  onToggle,
  viewMode,
  isLocked,
  examLoaded,
  examSubmitted,
  examPassed,
  examScore,
  examAnswered,
  examQuestionCount,
  examBusy,
  onStartCheckpoint,
  onOpenCheckpoint,
}: PhaseCardProps) {
  const passedCount = phaseLessonsPassed(phase, progress)
  const remainingLessons = Math.max(0, phase.lessons.length - passedCount)
  const allLessonsPassed = isPhaseLessonsComplete(phase, progress)
  const checkpointStatus = getCheckpointStatus(phase, progress, phaseProgress)
  const entry = phaseProgress[phase.id]
  const score = examLoaded && examSubmitted ? examScore : entry?.score ?? null
  const stateStyle = STATE_STYLES[state]
  const isLast = index === totalPhases - 1
  const phasePct = phase.lessons.length > 0 ? Math.round((passedCount / phase.lessons.length) * 100) : 0

  const statusLabel = stateStyle.label

  return (
    <Card
      id={`phase-${phase.id}`}
      className={cn(
        "scroll-mt-20 overflow-hidden transition-shadow",
        state === "current" && "border-primary/25 shadow-md"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`phase-body-${phase.id}`}
        className={cn(
          "flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/50",
          open && "bg-muted/25"
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
              stateStyle.box
            )}
            aria-hidden
          >
            {state === "done" ? (
              <Check className="h-4 w-4" />
            ) : state === "open" ? (
              <Trophy className="h-4 w-4" />
            ) : state === "current" ? (
              index + 1
            ) : (
              <Lock className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0 text-sm font-semibold leading-snug sm:text-base">
                Phase {index + 1}: {phase.title}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  stateStyle.badge
                )}
              >
                {statusLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {passedCount} of {phase.lessons.length} lessons passed ·{" "}
              {headerCheckpointCopy(checkpointStatus, remainingLessons, score)}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <div
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={`Phase ${index + 1} progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={phasePct}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    state === "done" ? "bg-ok-fg" : state === "open" ? "bg-warn-fg" : "bg-primary"
                  )}
                  style={{ width: `${phasePct}%` }}
                />
              </div>
              <span className="shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground">
                {phasePct}%
              </span>
            </div>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            id={`phase-body-${phase.id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border p-4">
              {state === "current" || state === "open" ? (
                <div
                  className={cn(
                    "mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
                    state === "open"
                      ? "border-warn-border bg-warn-bg/50 text-warn-fg"
                      : "border-primary/15 bg-primary/5 text-primary"
                  )}
                >
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    {state === "open"
                      ? "All lessons passed and the next phase is unlocked after two attempts, but this checkpoint still needs a pass to complete the phase."
                      : allLessonsPassed
                        ? isLast
                          ? "All lessons passed. Take the checkpoint to complete the roadmap."
                          : "All lessons passed. Take the checkpoint to unlock the next phase."
                        : "You're here. Finish these lessons to move on to the next phase."}
                  </span>
                </div>
              ) : null}

              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4"
                    : "space-y-2"
                }
              >
                {phase.lessons.map((lesson, lessonIndex) => {
                  const lessonProgress = progress[lesson.id]
                  const passed = lessonProgress?.passed === true
                  const retry = lessonProgress?.completed === true && !passed
                  const locked = isLocked(lesson, lessonIndex)
                  const href = `/roadmap/${roadmapId}/lesson/${lesson.id}`
                  const statusText = passed ? "Passed" : locked ? "Locked" : retry ? "Retry quiz" : "Start lesson"

                  const body = (
                    <div
                      className={cn(
                        "flex gap-3 rounded-xl border p-3 transition-colors",
                        viewMode === "grid" ? "h-full flex-col" : "items-center",
                        locked
                          ? "cursor-not-allowed border-border bg-muted/60 opacity-70"
                          : passed
                            ? "border-ok-border bg-ok-bg/40"
                            : retry
                              ? "border-warn-border bg-warn-bg/30"
                              : "border-border bg-card",
                        !locked && "group-hover:border-primary/30 group-hover:bg-muted/40"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                          passed
                            ? "bg-ok-fg text-white"
                            : locked
                              ? "bg-muted text-muted-foreground"
                              : retry
                                ? "border border-warn-border bg-warn-bg text-warn-fg"
                                : "bg-primary text-primary-foreground"
                        )}
                        aria-hidden
                      >
                        {passed ? <Check className="h-4 w-4" /> : locked ? <Lock className="h-3.5 w-3.5" /> : retry ? <RotateCcw className="h-3.5 w-3.5" /> : lessonIndex + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium leading-snug">{lesson.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                          <span
                            className={cn(
                              passed && "font-medium text-ok-fg",
                              retry && "font-medium text-warn-fg"
                            )}
                          >
                            {statusText}
                          </span>
                          {lesson.estimatedMinutes ? (
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="h-3 w-3" aria-hidden />
                              {lesson.estimatedMinutes} min
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {!locked && viewMode === "list" ? (
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                  )

                  if (locked) {
                    return (
                      <div
                        key={lesson.id}
                        className="group block"
                        aria-disabled="true"
                        title="Pass the previous step to unlock this lesson."
                      >
                        {body}
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={lesson.id}
                      href={href}
                      className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {body}
                    </Link>
                  )
                })}
              </div>

              <CheckpointCard
                status={checkpointStatus}
                allLessonsPassed={allLessonsPassed}
                remainingLessons={remainingLessons}
                lessons={phase.lessons.length}
                isLast={isLast}
                score={score}
                attempts={entry?.attempts ?? 0}
                examLoaded={examLoaded}
                examSubmitted={examSubmitted}
                examPassed={examPassed}
                examAnswered={examAnswered}
                examQuestionCount={examQuestionCount}
                examBusy={examBusy}
                onStartCheckpoint={onStartCheckpoint}
                onOpenCheckpoint={onOpenCheckpoint}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Card>
  )
}

type CheckpointCardProps = {
  status: CheckpointStatus
  allLessonsPassed: boolean
  remainingLessons: number
  lessons: number
  isLast: boolean
  score: number | null
  attempts: number
  examLoaded: boolean
  examSubmitted: boolean
  examPassed: boolean
  examAnswered: number
  examQuestionCount: number
  examBusy: boolean
  onStartCheckpoint: () => void
  onOpenCheckpoint: () => void
}

function CheckpointCard({
  status,
  allLessonsPassed,
  remainingLessons,
  lessons,
  isLast,
  score,
  attempts,
  examLoaded,
  examSubmitted,
  examPassed,
  examAnswered,
  examQuestionCount,
  examBusy,
  onStartCheckpoint,
  onOpenCheckpoint,
}: CheckpointCardProps) {
  const nextLabel = isLast ? "complete the roadmap" : "unlock the next phase"

  let tone: "muted" | "warn" | "ok" | "info" = "muted"
  let title = "Phase checkpoint"
  let copy = ""
  let action: { label: string; onClick: () => void; variant?: "default" | "outline" } | null = null
  let icon: typeof Trophy = Trophy

  if (examBusy) {
    tone = "info"
    icon = Loader2
    title = "Generating checkpoint…"
    copy = "Building questions across this phase. This can take a moment."
  } else if (examLoaded && !examSubmitted) {
    tone = "info"
    icon = Sparkles
    title = "Checkpoint in progress"
    copy = `${examAnswered} of ${examQuestionCount} questions answered. Your progress is kept until you submit.`
    action = { label: "Resume checkpoint", onClick: onOpenCheckpoint, variant: "outline" }
  } else if (examLoaded && examSubmitted) {
    if (examPassed) {
      tone = "ok"
      icon = CheckCircle2
      title = `Checkpoint passed — ${score ?? 0}%`
      copy = isLast
        ? "All requirements are complete. Review the quiz or keep practising."
        : "The next phase is unlocked. Review the quiz or keep practising."
    } else if (status === "passed") {
      tone = "ok"
      icon = CheckCircle2
      title = `Practice attempt — ${score ?? 0}%`
      copy = "You already passed this checkpoint, so your progress and unlock are unchanged."
    } else {
      tone = "warn"
      icon = Trophy
      title = `Checkpoint not passed — ${score ?? 0}%`
      copy =
        attempts >= 2
          ? "The next phase is already unlocked after two attempts. Review your answers or retake the checkpoint."
          : `Pass at ${PHASE_EXAM_PASS_THRESHOLD}% to ${nextLabel}. Review the explanations or try again.`
    }
    action = { label: "Review checkpoint", onClick: onOpenCheckpoint, variant: "outline" }
  } else if (status === "passed") {
    tone = "ok"
    icon = CheckCircle2
    title = score !== null ? `Checkpoint passed — ${score}%` : "Checkpoint passed"
    copy = isLast
      ? "The roadmap's final checkpoint is complete. Practice again whenever you like."
      : "The next phase is unlocked. Practice again whenever you like."
    action = { label: "Practice again", onClick: onStartCheckpoint, variant: "outline" }
  } else if (!allLessonsPassed) {
    tone = "muted"
    icon = Lock
    title = "Checkpoint locked"
    copy = `Pass all ${lessons} lessons in this phase to unlock the checkpoint. ${remainingLessons} lesson${remainingLessons === 1 ? "" : "s"} left.`
  } else if (status === "remedial") {
    tone = "warn"
    icon = Trophy
    title = "Checkpoint still open"
    copy = isLast
      ? "You can retake the checkpoint at any time to complete the roadmap."
      : "The next phase is unlocked after two attempts. Retake the checkpoint to earn the pass."
    action = { label: "Retake checkpoint", onClick: onStartCheckpoint }
  } else if (status === "retry") {
    tone = "warn"
    icon = Trophy
    title = "Checkpoint not passed yet"
    copy = score !== null
      ? `Last score ${score}%. Pass at ${PHASE_EXAM_PASS_THRESHOLD}% to ${nextLabel}.`
      : `Pass at ${PHASE_EXAM_PASS_THRESHOLD}% to ${nextLabel}.`
    action = { label: "Try again", onClick: onStartCheckpoint }
  } else {
    tone = "warn"
    icon = Trophy
    title = "Checkpoint ready"
    copy = `Pass at ${PHASE_EXAM_PASS_THRESHOLD}% to ${nextLabel}. The quiz samples the whole phase.`
    action = { label: "Start checkpoint", onClick: onStartCheckpoint }
  }

  const toneStyles = {
    muted: "border-border bg-muted/40",
    warn: "border-warn-border bg-warn-bg/50",
    ok: "border-ok-border bg-ok-bg/50",
    info: "border-info-border bg-info-bg/50",
  }[tone]

  return (
    <div className={cn("mt-4 rounded-xl border p-3.5 sm:p-4", toneStyles)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <IconBadge icon={icon} size="sm" tone={tone} />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{copy}</p>
          </div>
        </div>
        {action ? (
          <Button
            type="button"
            size="sm"
            variant={action.variant}
            onClick={action.onClick}
            disabled={examBusy}
            className="shrink-0"
          >
            {action.label}
          </Button>
        ) : examBusy ? (
          <Button type="button" size="sm" disabled className="shrink-0">
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            Generating…
          </Button>
        ) : null}
      </div>
    </div>
  )
}
