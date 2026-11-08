"use client"

import { useId } from "react"
import { ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react"
import { WidgetShell } from "@/components/dashboard/widget-shell"
import {
  formatMinutes,
  type RangeSummary,
  type WeekComparison,
} from "@/lib/analytics-insights"
import { cn } from "@/lib/utils"

type StudyTrendWidgetProps = {
  summary: RangeSummary
  week: WeekComparison
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) return null
  const positive = value >= 0
  const Icon = positive ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        positive ? "bg-ok-bg text-ok-fg" : "bg-danger-bg text-danger-fg"
      )}
      title="Study time vs the previous period"
    >
      <Icon className="h-3 w-3" aria-hidden />
      {positive ? "+" : ""}
      {value}%
    </span>
  )
}

export function StudyTrendWidget({ summary, week }: StudyTrendWidgetProps) {
  const gradientId = useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const days = summary.days
  const max = Math.max(1, ...days.map((day) => day.minutes))
  const top = 12
  const bottom = 140
  const width = 600
  const count = Math.max(1, days.length)
  const point = (minutes: number, index: number) => {
    const x = count === 1 ? width / 2 : (index / (count - 1)) * width
    const y = bottom - (minutes / max) * (bottom - top)
    return { x, y }
  }
  const points = days.map((day, index) => ({ ...point(day.minutes, index), day }))
  const line = points.map((p, index) => `${index === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
  const area = `${line} L${width},${bottom} L0,${bottom} Z`
  const nonzero = points.filter((p) => p.day.minutes > 0)
  const middle = days[Math.floor(days.length / 2)]
  const last = days[days.length - 1]
  const first = days[0]

  return (
    <WidgetShell
      icon={TrendingUp}
      title="Study time"
      subtitle={`${summary.range}-day trend`}
      action={<DeltaBadge value={summary.deltas.minutes} />}
    >
      <div className="rounded-xl border border-border bg-app/40 p-3">
        {summary.minutes === 0 ? (
          <p className="mb-2 text-xs text-muted-foreground">No study time logged in this range yet.</p>
        ) : null}
        <svg
          viewBox={`0 0 ${width} 160`}
          className="h-32 w-full"
          role="img"
          aria-label={`Daily study minutes for the last ${summary.range} days. Total ${summary.minutes} minutes, averaging ${summary.avgMinutesPerDay} minutes per day.`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0.33, 0.66].map((ratio) => (
            <line
              key={ratio}
              x1={0}
              x2={width}
              y1={bottom - ratio * (bottom - top)}
              y2={bottom - ratio * (bottom - top)}
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
          ))}
          <path d={area} fill={`url(#${gradientId})`} />
          <path
            d={line}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {nonzero.map((p) => (
            <circle key={p.day.key} cx={p.x} cy={p.y} r={3} fill="var(--primary)">
              <title>{`${p.day.label}: ${p.day.minutes}m · ${p.day.lessons} lessons`}</title>
            </circle>
          ))}
          <line x1={0} x2={width} y1={bottom} y2={bottom} stroke="var(--border)" strokeWidth="1" />
        </svg>
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span>{first?.label}</span>
          <span>{middle?.label}</span>
          <span>{last?.label}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-border bg-app/60 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">This week</p>
          <p className="mt-1 text-lg font-bold tracking-tight">{formatMinutes(week.currentMinutes)}</p>
          <p className="text-[11px] text-muted-foreground">
            {week.currentActiveDays}/{week.currentDays} active days
          </p>
        </div>
        <div className="rounded-xl border border-border bg-app/60 p-3">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Last week</p>
            <DeltaBadge value={week.deltaPct} />
          </div>
          <p className="mt-1 text-lg font-bold tracking-tight">{formatMinutes(week.previousMinutes)}</p>
          <p className="text-[11px] text-muted-foreground">
            {week.previousActiveDays}/{week.previousDays} active days
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{summary.avgMinutesPerDay}m per day average</span>
        <span>{summary.bestDay ? `Best: ${summary.bestDay.label} · ${summary.bestDay.minutes}m` : "No best day yet"}</span>
      </div>
    </WidgetShell>
  )
}
