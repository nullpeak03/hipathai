import Link from "next/link"
import { ArrowRight, CheckCircle2, ClipboardCheck, GraduationCap } from "lucide-react"
import type { ReviewItem, WeakTopic } from "@/lib/store"
import { cn } from "@/lib/utils"
import { WidgetShell } from "./widget-shell"

type ReviewWidgetProps = {
  reviews: ReviewItem[]
  weakTopics: WeakTopic[]
  lowMastery: string[]
  loaded: boolean
}

export function ReviewWidget({ reviews, weakTopics, lowMastery, loaded }: ReviewWidgetProps) {
  const weakChips = Array.from(
    new Set([...weakTopics.map((topic) => topic.topic), ...lowMastery])
  ).filter(Boolean).slice(0, 4)
  const visibleReviews = reviews.slice(0, 3)

  return (
    <WidgetShell
      icon={ClipboardCheck}
      title="Review & weak spots"
      subtitle={loaded ? `${reviews.length} due · ${weakChips.length} flagged` : "Checking your queue"}
      action={
        <Link
          href="/tutor"
          className="-m-1 inline-flex min-h-[36px] items-center gap-1 rounded-lg p-1 text-xs font-medium text-primary hover:bg-muted"
        >
          Tutor <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      }
    >
      {!loaded ? (
        <div className="space-y-3" aria-hidden>
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="h-12 animate-pulse rounded-xl bg-muted" />
          <div className="h-12 animate-pulse rounded-xl bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
      ) : (
        <div className="space-y-4">
          <section aria-labelledby="due-reviews-heading">
            <div className="flex items-center justify-between gap-2">
              <h3 id="due-reviews-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Due for review
              </h3>
              {reviews.length > 0 ? (
                <span className="rounded-full bg-warn-bg px-2 py-0.5 text-[11px] font-semibold text-warn-fg">
                  {reviews.length}
                </span>
              ) : null}
            </div>
            {visibleReviews.length > 0 ? (
              <div className="mt-1">
                {visibleReviews.map((item) => (
                  <Link
                    key={`${item.roadmapId}-${item.lessonId}`}
                    href={`/roadmap/${item.roadmapId}/lesson/${item.lessonId}`}
                    className="group flex min-h-[48px] items-center gap-2.5 border-t border-border py-2 first:border-t-0"
                  >
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        item.overdueDays > 0 ? "bg-danger-fg" : "bg-warn-fg"
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{item.topic || item.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {item.overdueDays > 0 ? `${item.overdueDays}d overdue` : "Due today"}
                      </span>
                    </span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-2 flex items-center gap-2 rounded-xl border border-ok-border bg-ok-bg px-3 py-2.5 text-xs text-ok-fg">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                Nothing due — spaced reviews appear here after a missed question.
              </p>
            )}
          </section>

          <section aria-labelledby="weak-topics-heading">
            <h3 id="weak-topics-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Weak topics
            </h3>
            {weakChips.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {weakChips.map((topic) => (
                  <Link
                    key={topic}
                    href={`/tutor?q=${encodeURIComponent(`Help me master: ${topic}`)}`}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-warn-border bg-warn-bg px-3 text-xs font-medium text-warn-fg hover:bg-warn-bg/80"
                  >
                    <GraduationCap className="h-3.5 w-3.5" aria-hidden />
                    {topic}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                No weak topics flagged yet. Missed quiz questions will show up here.
              </p>
            )}
          </section>
        </div>
      )}
    </WidgetShell>
  )
}
