import { Flame } from "lucide-react"
import { heatLevel, type DashboardDay } from "@/lib/dashboard"
import { WidgetShell } from "./widget-shell"

type StreakCalendarWidgetProps = {
  days: DashboardDay[]
  streak: number
  bestStreak: number
  loaded: boolean
}

const HEAT_BG = ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3"] as const
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

export function StreakCalendarWidget({ days, streak, bestStreak, loaded }: StreakCalendarWidgetProps) {
  const active = days.filter((day) => day.active).length

  return (
    <WidgetShell
      icon={Flame}
      title="Streak"
      subtitle={`${streak}-day current · ${bestStreak}-day best`}
    >
      {!loaded ? (
        <div className="space-y-3" aria-hidden>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 28 }).map((_, index) => (
              <div key={index} className="aspect-square animate-pulse rounded-[6px] bg-muted" />
            ))}
          </div>
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1.5" role="img" aria-label={`Streak calendar for the last 28 days. ${active} active days.`}>
            {WEEKDAYS.map((day) => (
              <span key={day} className="text-center text-[9px] font-medium uppercase text-muted-foreground" aria-hidden>
                {day.slice(0, 1)}
              </span>
            ))}
            {days.map((day) => {
              const level = heatLevel(day.minutes)
              return (
                <span
                  key={day.key}
                  aria-hidden
                  title={`${day.label}: ${day.minutes}m · ${day.lessons} lessons`}
                  className={`aspect-square rounded-[6px] ${
                    day.isFuture
                      ? "border border-dashed border-border bg-transparent"
                      : HEAT_BG[level]
                  } ${day.isToday ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : ""}`}
                />
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>{active}/28 active days</span>
            <span className="inline-flex items-center gap-1" aria-hidden>
              Less
              {HEAT_BG.map((background) => (
                <span key={background} className={`h-2.5 w-2.5 rounded-[3px] ${background}`} />
              ))}
              More
            </span>
          </div>
        </>
      )}
    </WidgetShell>
  )
}
