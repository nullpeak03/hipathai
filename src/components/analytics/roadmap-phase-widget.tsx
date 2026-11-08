import Link from "next/link"
import { ArrowRight, ArrowUpRight, Map as MapIcon, Route } from "lucide-react"
import { WidgetShell } from "@/components/dashboard/widget-shell"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import type { RoadmapSummary } from "@/lib/analytics-insights"
import type { NextLessonAction } from "@/lib/daily-priority"

type RoadmapPhaseWidgetProps = {
  summary: RoadmapSummary
  nextLesson: NextLessonAction
}

export function RoadmapPhaseWidget({ summary, nextLesson }: RoadmapPhaseWidgetProps) {
  if (!summary.hasRoadmap) {
    return (
      <WidgetShell icon={MapIcon} title="Roadmap" subtitle="Your learning path">
        <EmptyState
          compact
          icon={MapIcon}
          title="No roadmap yet"
          description="Create a personalized plan to unlock phase and lesson progress."
          action={
            <Button asChild size="sm">
              <Link href="/onboarding">Create roadmap</Link>
            </Button>
          }
        />
      </WidgetShell>
    )
  }

  return (
    <WidgetShell
      icon={Route}
      title="Roadmap progress"
      subtitle={summary.title}
      action={
        <Link
          href="/roadmap"
          className="-m-1 inline-flex min-h-[36px] items-center gap-1 rounded-lg p-1 text-xs font-medium text-primary hover:bg-muted"
        >
          Open <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      }
    >
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-3xl font-bold tracking-tight">{summary.pct}%</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.done} of {summary.total} lessons
          </p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {summary.remaining} left
        </span>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Roadmap completion"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={summary.pct}
      >
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${summary.pct}%` }} />
      </div>

      {summary.currentPhaseTitle ? (
        <div className="mt-4 rounded-xl border border-border bg-app/60 p-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-medium">
              Phase {summary.phaseIndex} · {summary.currentPhaseTitle}
            </span>
            <span className="shrink-0 text-muted-foreground">
              {summary.phasePassed}/{summary.phaseLessons}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-ok-fg transition-all"
              style={{ width: `${summary.phasePct}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {summary.checkpointReady
              ? "Phase complete — take the checkpoint quiz."
              : summary.lessonsLeftInPhase > 0
                ? `${summary.lessonsLeftInPhase} lesson${summary.lessonsLeftInPhase === 1 ? "" : "s"} left in this phase.`
                : "Phase complete."}
          </p>
        </div>
      ) : null}

      <Link
        href={nextLesson.href}
        className="group mt-3 flex min-h-[44px] items-center justify-between gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
      >
        <span className="min-w-0">
          <span className="block truncate">{nextLesson.title}</span>
          <span className="block truncate text-[11px] font-normal text-muted-foreground">
            {nextLesson.detail}
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </WidgetShell>
  )
}
