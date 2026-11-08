import Link from "next/link"
import { ArrowUpRight, Target } from "lucide-react"
import { WidgetShell } from "@/components/dashboard/widget-shell"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import type { MasterySummary, MasteryBand } from "@/lib/analytics-insights"
import { cn } from "@/lib/utils"
import { BAND_META, bandBar } from "./mastery-meta"

type MasteryBreakdownWidgetProps = {
  mastery: MasterySummary
}

const BAND_ORDER: MasteryBand[] = ["mastered", "proficient", "developing", "needs-practice"]

export function MasteryBreakdownWidget({ mastery }: MasteryBreakdownWidgetProps) {
  return (
    <WidgetShell
      icon={Target}
      title="Mastery breakdown"
      subtitle={mastery.total > 0 ? `${mastery.total} topics practiced` : "Across practiced topics"}
      action={
        mastery.hasData ? (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{mastery.average}% avg</span>
        ) : null
      }
    >
      {!mastery.hasData ? (
        <EmptyState
          compact
          icon={Target}
          title="No mastery data yet"
          description="Pass lesson quizzes to build a topic-by-topic mastery map."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/roadmap">Go to roadmap</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex items-center gap-4">
            <div className="relative h-[74px] w-[74px] shrink-0">
              <svg viewBox="0 0 36 36" className="h-[74px] w-[74px] -rotate-90" aria-hidden>
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
                  strokeDasharray={`${mastery.average} ${100 - mastery.average}`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                {mastery.average}%
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Average mastery</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {mastery.mastered} of {mastery.total} {mastery.total === 1 ? "topic" : "topics"} at 90%+
              </p>
              {mastery.strongest ? (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  Strongest: <span className="font-medium text-foreground">{mastery.strongest.topic}</span>{" "}
                  {mastery.strongest.score}%
                </p>
              ) : null}
            </div>
          </div>

          {mastery.topics.length > 0 ? (
            <>
              <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                {BAND_ORDER.map((band) => {
                  const count = mastery.bands[band]
                  if (count === 0) return null
                  return (
                    <span
                      key={band}
                      className={BAND_META[band].bar}
                      style={{ width: `${(count / mastery.topics.length) * 100}%` }}
                    />
                  )
                })}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                {BAND_ORDER.filter((band) => mastery.bands[band] > 0).map((band) => (
                  <span key={band} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={cn("h-2 w-2 rounded-full", BAND_META[band].bar)} aria-hidden />
                    {BAND_META[band].label} · {mastery.bands[band]}
                  </span>
                ))}
              </div>

              <div className="mt-4 space-y-2.5">
                {mastery.topics.slice(0, 5).map((topic) => (
                  <div key={topic.topic}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium">{topic.topic}</span>
                      <span className={cn("shrink-0 text-xs font-semibold", BAND_META[topic.band].text)}>
                        {topic.score}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", bandBar(topic.score))}
                        style={{ width: `${topic.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              Per-topic detail appears after your first graded quiz. Overall mastery is already being tracked.
            </p>
          )}

          {mastery.weakest && mastery.weakest.score < 70 ? (
            <Link
              href={`/tutor?q=${encodeURIComponent(`Help me master: ${mastery.weakest.topic}`)}`}
              className="mt-4 inline-flex min-h-[36px] items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Practice {mastery.weakest.topic}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : null}
        </>
      )}
    </WidgetShell>
  )
}
