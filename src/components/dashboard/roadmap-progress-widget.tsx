import Link from "next/link"
import { ArrowUpRight, Map as MapIcon, Route } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import type { PhaseProgress, Progress, RoadmapData } from "@/lib/store"
import { WidgetShell } from "./widget-shell"

type RoadmapProgressWidgetProps = {
  roadmap: RoadmapData | null
  progress: Progress
  phaseProgress: PhaseProgress
  hydrated: boolean
}

export function RoadmapProgressWidget({ roadmap, progress, phaseProgress, hydrated }: RoadmapProgressWidgetProps) {
  if (!hydrated) {
    return (
      <WidgetShell icon={Route} title="Roadmap" subtitle="Your learning path">
        <div className="space-y-3" aria-hidden>
          <div className="h-9 w-24 animate-pulse rounded bg-muted" />
          <div className="h-3 w-40 animate-pulse rounded bg-muted" />
          <div className="h-2 animate-pulse rounded-full bg-muted" />
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
        </div>
      </WidgetShell>
    )
  }

  if (!roadmap) {
    return (
      <WidgetShell icon={MapIcon} title="Roadmap" subtitle="Your learning path">
        <EmptyState
          compact
          icon={MapIcon}
          title="No roadmap yet"
          description="Tell us your goal and get a personalized, week-by-week plan."
          action={
            <Button asChild size="sm">
              <Link href="/onboarding">Create roadmap</Link>
            </Button>
          }
        />
      </WidgetShell>
    )
  }

  const allLessons = roadmap.phases.flatMap((phase) => phase.lessons)
  const total = allLessons.length || roadmap.totalLessons
  const done = allLessons.filter((lesson) => progress[lesson.id]?.completed).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const currentPhase =
    roadmap.phases.find((phase) => phase.lessons.some((lesson) => progress[lesson.id]?.passed !== true)) ??
    roadmap.phases[roadmap.phases.length - 1]
  const phaseLessons = currentPhase?.lessons ?? []
  const phasePassed = phaseLessons.filter((lesson) => progress[lesson.id]?.passed).length
  const phasePct = phaseLessons.length > 0 ? Math.round((phasePassed / phaseLessons.length) * 100) : 0
  const phaseIndex = currentPhase ? roadmap.phases.findIndex((phase) => phase.id === currentPhase.id) + 1 : 0
  const phaseExam = currentPhase ? phaseProgress[currentPhase.id] : undefined
  const remaining = Math.max(0, total - done)

  return (
    <WidgetShell
      icon={Route}
      title="Roadmap"
      subtitle={roadmap.title}
      action={
        <Link
          href="/roadmap"
          className="-m-1 inline-flex min-h-[36px] items-center gap-1 rounded-lg p-1 text-xs font-medium text-primary hover:bg-muted"
        >
          Open <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      }
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-bold tracking-tight">{pct}%</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {done} of {total} lessons complete
          </p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {remaining} left
        </span>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Roadmap completion"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      {currentPhase ? (
        <div className="mt-4 rounded-xl border border-border bg-app/60 p-3.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-medium">
              Phase {phaseIndex} · {currentPhase.title}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {phasePassed}/{phaseLessons.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-ok-fg transition-all" style={{ width: `${phasePct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {phasePct === 100
              ? phaseExam?.passed
                ? "Phase checkpoint passed."
                : "Phase complete — take the checkpoint quiz."
              : `${phaseLessons.length - phasePassed} lessons left in this phase.`}
          </p>
        </div>
      ) : null}
    </WidgetShell>
  )
}
