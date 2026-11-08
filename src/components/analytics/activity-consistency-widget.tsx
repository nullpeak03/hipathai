import { CalendarCheck2 } from "lucide-react"
import { WidgetShell } from "@/components/dashboard/widget-shell"
import { heatLevel } from "@/lib/dashboard"
import { formatMinutes, type AnalyticsDay, type RangeSummary } from "@/lib/analytics-insights"
import { cn } from "@/lib/utils"

type ActivityConsistencyWidgetProps = {
  summary: RangeSummary
  streak: number
  bestStreak: number
}

const HEAT_BG = ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3"] as const
const WEEKDAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"] as const

function dayFromKey(key: string): Date {
  return new Date(`${key}T12:00:00.000Z`)
}

/** Pads the range into Monday-to-Sunday columns for a GitHub-style grid. */
function toWeekColumns(days: AnalyticsDay[]): (AnalyticsDay | null)[][] {
  if (days.length === 0) return []
  const first = dayFromKey(days[0].key)
  const lead = (first.getUTCDay() + 6) % 7
  const cells: (AnalyticsDay | null)[] = [...Array<null>(lead).fill(null), ...days]
  while (cells.length % 7 !== 0) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7)
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-app/60 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  )
}

export function ActivityConsistencyWidget({
  summary,
  streak,
  bestStreak,
}: ActivityConsistencyWidgetProps) {
  const weeks = toWeekColumns(summary.days)
  const active = summary.activeDays

  return (
    <WidgetShell
      icon={CalendarCheck2}
      title="Activity & consistency"
      subtitle={formatMinutes(summary.minutes) + " · " + `${summary.lessons} lessons`}
    >
      {summary.range === 7 ? (
        <div
          className="grid grid-cols-7 gap-2"
          role="img"
          aria-label={`Study heatmap for the last 7 days. ${active} active days, ${summary.consistency}% consistency.`}
        >
          {summary.days.map((day) => {
            const level = heatLevel(day.minutes)
            return (
              <div key={day.key} aria-hidden>
                <p className="text-center text-[10px] font-medium uppercase text-muted-foreground">
                  {day.weekday.slice(0, 1)}
                </p>
                <div
                  title={`${day.label}: ${day.minutes}m · ${day.lessons} lessons`}
                  className={cn(
                    "mt-1 flex h-16 flex-col items-center justify-center rounded-xl text-xs",
                    HEAT_BG[level],
                    level >= 2 ? "text-heat-strong" : "text-foreground",
                    day.isToday && "ring-2 ring-primary ring-offset-2 ring-offset-card"
                  )}
                >
                  <span className="font-semibold">{day.minutes > 0 ? `${day.minutes}m` : "—"}</span>
                  <span className="text-[10px] opacity-75">{day.dayNum}</span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="overflow-x-auto pb-1">
          <div
            className="inline-flex min-w-full gap-1.5"
            role="img"
            aria-label={`Study heatmap for the last ${summary.range} days. ${active} active days, ${summary.consistency}% consistency.`}
          >
            <div className="mr-1 grid grid-rows-7 gap-1.5" aria-hidden>
              {WEEKDAY_LABELS.map((label, index) => (
                <span
                  key={index}
                  className="flex h-3.5 w-6 items-center text-[9px] text-muted-foreground sm:h-4"
                >
                  {label}
                </span>
              ))}
            </div>
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-rows-7 gap-1.5">
                {week.map((day, dayIndex) =>
                  day ? (
                    <span
                      key={`${weekIndex}-${dayIndex}`}
                      aria-hidden
                      title={`${day.label}: ${day.minutes}m · ${day.lessons} lessons`}
                      className={cn(
                        "h-3.5 w-3.5 rounded-[4px] sm:h-4 sm:w-4",
                        HEAT_BG[heatLevel(day.minutes)],
                        day.isToday && "ring-2 ring-primary ring-offset-1 ring-offset-card"
                      )}
                    />
                  ) : (
                    <span key={`${weekIndex}-${dayIndex}`} className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{active}</span> of {summary.range} active days
        </span>
        <span className="inline-flex items-center gap-1" aria-hidden>
          Less
          {HEAT_BG.map((background) => (
            <span key={background} className={cn("h-2.5 w-2.5 rounded-[3px]", background)} />
          ))}
          More
        </span>
      </div>

      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Active-day consistency"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={summary.consistency}
      >
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${summary.consistency}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Consistency" value={`${summary.consistency}%`} />
        <Stat label="Current streak" value={`${streak}d`} />
        <Stat label="Longest run" value={`${Math.max(summary.longestRun, bestStreak)}d`} />
        <Stat label="Active avg" value={`${summary.avgMinutesPerActiveDay}m`} />
      </div>

      {summary.minutes === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Finish a lesson to start filling in your heatmap.
        </p>
      ) : null}
    </WidgetShell>
  )
}
