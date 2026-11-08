"use client"

import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck2,
  Flame,
  Percent,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react"
import { AnimatedNumber } from "@/components/effects/animated-number"
import { Card } from "@/components/ui/card"
import { IconBadge } from "@/components/ui/icon-badge"
import type { MasterySummary, RangeSummary } from "@/lib/analytics-insights"
import { progressToNextLevel } from "@/lib/gamification"
import type { Gamification } from "@/lib/store"
import { cn } from "@/lib/utils"

type AnalyticsKpiRowProps = {
  gam: Gamification
  summary: RangeSummary
  mastery: MasterySummary
}

function Delta({ value, label }: { value: number | null; label: string }) {
  if (value === null) return null
  const positive = value >= 0
  const Icon = positive ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-medium",
        positive ? "text-ok-fg" : "text-danger-fg"
      )}
      title={label}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {positive ? "+" : ""}
      {value}%
    </span>
  )
}

function KpiTile({
  icon,
  label,
  value,
  prefix,
  suffix,
  detail,
  delta,
  deltaLabel,
}: {
  icon: LucideIcon
  label: string
  value: number
  prefix?: string
  suffix?: string
  detail: React.ReactNode
  delta?: number | null
  deltaLabel?: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        <IconBadge icon={icon} size="sm" tone="muted" />
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        {prefix ? <span className="text-sm font-semibold text-muted-foreground">{prefix}</span> : null}
        <span className="text-2xl font-bold tracking-tight">
          <AnimatedNumber value={value} />
        </span>
        {suffix ? <span className="text-sm font-medium text-muted-foreground">{suffix}</span> : null}
      </div>
      <div className="mt-1 flex min-h-[18px] flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <span>{detail}</span>
        {delta !== undefined ? <Delta value={delta} label={deltaLabel ?? "Change from previous period"} /> : null}
      </div>
    </Card>
  )
}

/** Five compact signals: level/XP, pass rate, streak, consistency, mastery. */
export function AnalyticsKpiRow({ gam, summary, mastery }: AnalyticsKpiRowProps) {
  const level = progressToNextLevel(gam.xp)

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <KpiTile
        icon={Trophy}
        label="Level"
        value={level.level}
        prefix="Lv."
        detail={`${gam.xp} XP total`}
      />
      <KpiTile
        icon={Percent}
        label="Pass rate"
        value={gam.passRate}
        suffix="%"
        detail="Quiz pass rate"
      />
      <KpiTile
        icon={Flame}
        label="Streak"
        value={gam.streak}
        suffix="d"
        detail={`Best ${gam.bestStreak}d`}
      />
      <KpiTile
        icon={CalendarCheck2}
        label="Active days"
        value={summary.activeDays}
        suffix={`/${summary.range}`}
        detail={`${summary.consistency}% consistency`}
        delta={summary.deltas.activeDays}
        deltaLabel="Active days vs previous period"
      />
      <KpiTile
        icon={Target}
        label="Mastery"
        value={mastery.average}
        suffix="%"
        detail={
          mastery.total > 0
            ? `${mastery.mastered}/${mastery.total} mastered`
            : "No topics graded yet"
        }
      />
    </div>
  )
}
