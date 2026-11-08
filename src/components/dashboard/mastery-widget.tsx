import Link from "next/link"
import { ArrowRight, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { LearningAnalytics } from "@/lib/store"
import { WidgetShell } from "./widget-shell"

type MasteryWidgetProps = {
  analytics: LearningAnalytics | null
  loaded: boolean
}

export function MasteryWidget({ analytics, loaded }: MasteryWidgetProps) {
  const average = analytics?.average ?? 0
  const total = analytics?.total ?? 0
  const mastered = analytics?.mastered ?? 0
  const lowMastery = analytics?.lowMastery.slice(0, 3) ?? []

  return (
    <WidgetShell icon={Target} title="Mastery" subtitle="Across practiced topics">
      {!loaded ? (
        <div className="space-y-4" aria-hidden>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="h-3 animate-pulse rounded bg-muted" />
        </div>
      ) : total === 0 ? (
        <div className="flex h-full flex-col items-start justify-center gap-2 py-4">
          <p className="text-sm font-medium">No mastery data yet</p>
          <p className="text-xs text-muted-foreground">Pass lesson quizzes to build your mastery map.</p>
          <Button asChild size="sm" variant="outline" className="mt-1">
            <Link href="/roadmap">Go to roadmap</Link>
          </Button>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0">
              <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90" aria-hidden>
                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--muted)" strokeWidth="3.5" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.9155"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray={`${average} ${100 - average}`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{average}%</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">Average mastery</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {mastered} of {total} {total === 1 ? "topic" : "topics"} mastered
              </p>
            </div>
          </div>

          <div
            className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Average topic mastery"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={average}
          >
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${average}%` }} />
          </div>

          {lowMastery.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Needs practice</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {lowMastery.map((topic) => (
                  <Link
                    key={topic}
                    href={`/tutor?q=${encodeURIComponent(`Help me master: ${topic}`)}`}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-border bg-app/60 px-3 text-xs font-medium hover:bg-muted"
                  >
                    {topic}
                    <ArrowRight className="h-3 w-3" aria-hidden />
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">Every practiced topic is at mastery level. Keep it up.</p>
          )}
        </div>
      )}
    </WidgetShell>
  )
}
