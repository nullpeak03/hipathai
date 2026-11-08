import { Zap } from "lucide-react"
import { WidgetShell } from "@/components/dashboard/widget-shell"
import type { RangeSummary, XpSummary } from "@/lib/analytics-insights"
import type { Gamification } from "@/lib/store"

type XpProgressWidgetProps = {
  gam: Gamification
  summary: RangeSummary
  xp: XpSummary
}

export function XpProgressWidget({ gam, summary, xp }: XpProgressWidgetProps) {
  const max = Math.max(1, ...summary.days.map((day) => day.xp))
  const first = summary.days[0]
  const last = summary.days[summary.days.length - 1]

  return (
    <WidgetShell
      icon={Zap}
      title="XP & level progression"
      subtitle={`Level ${xp.level} · ${xp.remainingToNext} XP to Level ${xp.level + 1}`}
      action={
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          +{xp.xpInRange} XP
        </span>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[190px_1fr] lg:items-center">
        <div className="flex items-center gap-4">
          <div className="relative h-[84px] w-[84px] shrink-0">
            <svg viewBox="0 0 36 36" className="h-[84px] w-[84px] -rotate-90" aria-hidden>
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
                strokeDasharray={`${xp.progress} ${100 - xp.progress}`}
              />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Lv.</span>
              <span className="text-lg font-bold leading-none">{xp.level}</span>
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold">{gam.xp} XP total</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {xp.remainingToNext} XP to Level {xp.level + 1}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {Math.round(xp.progress)}% through this level
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <div
            className="flex h-24 items-end gap-[2px]"
            role="img"
            aria-label={`Daily XP for the last ${summary.range} days. ${xp.xpInRange} XP earned in this period, averaging ${xp.xpPerActiveDay} XP per active day.`}
          >
            {summary.days.map((day) => {
              const height = day.xp > 0 ? Math.max(6, Math.round((day.xp / max) * 100)) : 3
              return (
                <div key={day.key} className="flex h-full min-w-0 flex-1 items-end" aria-hidden>
                  <div
                    title={`${day.label}: ${day.xp} XP`}
                    className={`w-full rounded-t-[3px] ${day.xp > 0 ? "bg-primary" : "bg-muted"}`}
                    style={{ height: `${height}%` }}
                  />
                </div>
              )
            })}
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span>{first?.label}</span>
            <span>Daily XP</span>
            <span>{last?.label}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">This period</p>
              <p className="text-sm font-semibold">{xp.xpInRange} XP</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Per active day</p>
              <p className="text-sm font-semibold">{xp.xpPerActiveDay} XP</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Next level</p>
              <p className="text-sm font-semibold">{xp.nextThreshold} XP</p>
            </div>
          </div>
        </div>
      </div>
    </WidgetShell>
  )
}
