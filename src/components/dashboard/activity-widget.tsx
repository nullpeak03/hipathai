import Link from "next/link"
import { ArrowUpRight, BarChart3 } from "lucide-react"
import { activeDayCount, sumMinutes, type DashboardDay } from "@/lib/dashboard"
import { WidgetShell } from "./widget-shell"

type ActivityWidgetProps = {
  days: DashboardDay[]
  loaded: boolean
}

const SKELETON_HEIGHTS = [34, 52, 28, 68, 44, 76, 38, 58, 30, 64, 42, 72, 36, 56]

export function ActivityWidget({ days, loaded }: ActivityWidgetProps) {
  const total = sumMinutes(days)
  const active = activeDayCount(days)
  const max = Math.max(1, ...days.map((day) => day.minutes))

  return (
    <WidgetShell
      icon={BarChart3}
      title="Activity"
      subtitle="Last 14 days"
      action={
        <Link
          href="/analytics"
          className="-m-1 inline-flex min-h-[36px] items-center gap-1 rounded-lg p-1 text-xs font-medium text-primary hover:bg-muted"
        >
          Details <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      }
    >
      {!loaded ? (
        <div className="flex h-[118px] items-end gap-1.5" aria-hidden>
          {SKELETON_HEIGHTS.map((height, index) => (
            <div
              key={index}
              className="flex-1 animate-pulse rounded-t bg-muted"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      ) : (
        <>
          <ul className="sr-only">
            {days.map((day) => (
              <li key={day.key}>
                {day.label}: {day.minutes} minutes, {day.lessons} lessons
              </li>
            ))}
          </ul>
          <div className="flex h-[118px] items-end gap-1.5" aria-hidden>
            {days.map((day) => {
              const barHeight = day.minutes > 0 ? Math.max(8, Math.round((day.minutes / max) * 100)) : 4
              return (
                <div key={day.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className="flex w-full flex-1 items-end"
                    title={`${day.label}: ${day.minutes}m · ${day.lessons} lessons`}
                  >
                    <div
                      className={`w-full rounded-t-[4px] transition-all ${day.minutes > 0 ? "bg-primary" : "bg-muted"}`}
                      style={{ height: `${barHeight}%` }}
                    />
                  </div>
                  <span className={`text-[9px] leading-none ${day.isToday ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                    {day.weekday.slice(0, 1)}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>
          {loaded ? (
            <>
              <span className="font-semibold text-foreground">{total}m</span> total
            </>
          ) : (
            <span className="inline-block h-3 w-14 animate-pulse rounded bg-muted" aria-hidden />
          )}
        </span>
        <span>
          {loaded ? (
            `${active}/14 active days`
          ) : (
            <span className="inline-block h-3 w-20 animate-pulse rounded bg-muted" aria-hidden />
          )}
        </span>
      </div>
      {loaded && total === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Finish a lesson to start your activity chart.</p>
      ) : null}
    </WidgetShell>
  )
}
