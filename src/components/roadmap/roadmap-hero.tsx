"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle2, Clock, Flame, Loader2, PlayCircle, Sparkles, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { IconBadge } from "@/components/ui/icon-badge"
import { ProgressRing } from "@/components/ui/progress-ring"
import type { CheckpointStatus } from "@/lib/roadmap-progress"
import { cn } from "@/lib/utils"

export type HeroNextStep =
  | {
      kind: "lesson"
      label: string
      title: string
      detail: string
      href: string
    }
  | {
      kind: "checkpoint"
      label: string
      title: string
      detail: string
      /** Phase whose checkpoint is being generated/opened. */
      phaseId: string
      onStart: () => void
    }
  | {
      kind: "complete"
      label: string
      title: string
      detail: string
      /** Optional CTA copy when the complete state is not a finished roadmap. */
      actionLabel?: string
      onReview: () => void
    }

export type HeroCurrentPhase = {
  index: number
  total: number
  title: string
  passed: number
  lessons: number
  checkpoint: CheckpointStatus
  checkpointScore: number | null
  isLast: boolean
}

type RoadmapHeroProps = {
  pct: number
  passed: number
  total: number
  remaining: number
  timeLeft: string
  streak: number
  phaseCount: number
  checkpointsPassed: number
  currentPhase: HeroCurrentPhase | null
  nextStep: HeroNextStep
  nextStepBusy?: boolean
  onOpenPhase: () => void
  onViewPhases: () => void
  onOpenSkills: () => void
}

function checkpointCopy(phase: HeroCurrentPhase): string {
  const nextLabel = phase.isLast ? "complete the roadmap" : "unlock the next phase"
  switch (phase.checkpoint) {
    case "passed":
      return phase.checkpointScore !== null
        ? `Checkpoint passed · ${phase.checkpointScore}%`
        : "Checkpoint passed."
    case "ready":
      return `Checkpoint ready — pass it to ${nextLabel}.`
    case "retry":
      return phase.checkpointScore !== null
        ? `Checkpoint not passed · ${phase.checkpointScore}%. Try again to ${nextLabel}.`
        : `Checkpoint not passed yet. Try again to ${nextLabel}.`
    case "remedial":
      return phase.isLast
        ? "Checkpoint still open. Retake it to complete the roadmap."
        : "Checkpoint still open. The next phase is already unlocked after two attempts."
    default:
      return `${Math.max(0, phase.lessons - phase.passed)} lesson${phase.lessons - phase.passed === 1 ? "" : "s"} until the checkpoint unlocks.`
  }
}

function NextStepIcon({ step }: { step: HeroNextStep }) {
  if (step.kind === "complete") return <CheckCircle2 className="h-4 w-4" aria-hidden />
  if (step.kind === "checkpoint") return <Sparkles className="h-4 w-4" aria-hidden />
  return <PlayCircle className="h-4 w-4" aria-hidden />
}

export function RoadmapHero({
  pct,
  passed,
  total,
  remaining,
  timeLeft,
  streak,
  phaseCount,
  checkpointsPassed,
  currentPhase,
  nextStep,
  nextStepBusy = false,
  onOpenPhase,
  onViewPhases,
  onOpenSkills,
}: RoadmapHeroProps) {
  const phasePct =
    currentPhase && currentPhase.lessons > 0
      ? Math.round((currentPhase.passed / currentPhase.lessons) * 100)
      : 0

  return (
    <Card className="overflow-hidden">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="shrink-0 text-primary">
              <ProgressRing pct={pct} size={96} stroke={9} label={`${pct}%`} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Overall progress
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight">
                {passed} of {total} lessons passed
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1">
                  <Clock className="h-3.5 w-3.5 text-primary" aria-hidden />
                  {remaining === 0 ? "All lessons passed" : `≈ ${timeLeft} left`}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1">
                  <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden />
                  {streak} day{streak === 1 ? "" : "s"} streak
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                  {checkpointsPassed}/{phaseCount} checkpoints
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-border bg-app/60 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <NextStepIcon step={nextStep} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {nextStep.label}
                </p>
                <p className="mt-0.5 text-sm font-semibold leading-snug">{nextStep.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{nextStep.detail}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {nextStep.kind === "lesson" ? (
                <Button asChild size="sm">
                  <Link href={nextStep.href}>
                    <PlayCircle className="mr-1 h-4 w-4" aria-hidden />
                    Continue lesson
                  </Link>
                </Button>
              ) : nextStep.kind === "checkpoint" ? (
                <Button size="sm" onClick={nextStep.onStart} disabled={nextStepBusy}>
                  {nextStepBusy ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="mr-1 h-4 w-4" aria-hidden />
                  )}
                  {nextStepBusy ? "Preparing checkpoint…" : "Take checkpoint"}
                </Button>
              ) : (
                <Button size="sm" onClick={nextStep.onReview}>
                  <Trophy className="mr-1 h-4 w-4" aria-hidden />
                  {nextStep.actionLabel ?? "Review skills"}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onViewPhases}>
                View phases
              </Button>
            </div>
          </div>
        </div>

        <aside className="border-t border-border bg-app/40 p-5 sm:p-6 lg:border-l lg:border-t-0">
          {currentPhase ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Focus phase
                  </p>
                  <h2 className="mt-1 text-base font-semibold leading-snug">{currentPhase.title}</h2>
                </div>
                <span className="shrink-0 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {currentPhase.index + 1}/{currentPhase.total}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {currentPhase.passed} of {currentPhase.lessons} lessons passed
              </p>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={`${currentPhase.title} progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={phasePct}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    currentPhase.checkpoint === "passed" ? "bg-ok-fg" : "bg-primary"
                  )}
                  style={{ width: `${phasePct}%` }}
                />
              </div>
              <p
                className={cn(
                  "mt-3 text-xs",
                  currentPhase.checkpoint === "ready" || currentPhase.checkpoint === "retry"
                    ? "text-warn-fg"
                    : currentPhase.checkpoint === "passed"
                      ? "text-ok-fg"
                      : "text-muted-foreground"
                )}
              >
                {checkpointCopy(currentPhase)}
              </p>
              <button
                type="button"
                onClick={onOpenPhase}
                className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                Open this phase
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </>
          ) : (
            <>
              <IconBadge icon={Trophy} size="sm" tone="ok" />
              <h2 className="mt-3 text-base font-semibold">Roadmap complete</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Every lesson and phase checkpoint is passed. Your final readiness snapshot is ready to review.
              </p>
              <button
                type="button"
                onClick={onOpenSkills}
                className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                Review skills & readiness
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </>
          )}
        </aside>
      </div>
    </Card>
  )
}
