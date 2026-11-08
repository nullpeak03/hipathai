import Link from "next/link"
import {
  ArrowRight,
  CalendarCheck2,
  Flame,
  Sparkles,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { IconBadge } from "@/components/ui/icon-badge"
import type { CoachingInsight, InsightTone } from "@/lib/analytics-insights"

type AnalyticsHeroProps = {
  insight: CoachingInsight
}

const TONE_META: Record<
  InsightTone,
  { icon: LucideIcon; tone: "primary" | "info" | "ok" | "warn"; label: string }
> = {
  start: { icon: Sparkles, tone: "primary", label: "Start" },
  focus: { icon: Target, tone: "warn", label: "Focus" },
  build: { icon: CalendarCheck2, tone: "info", label: "Build" },
  celebrate: { icon: Trophy, tone: "ok", label: "Momentum" },
}

const TONE_ACCENT: Record<InsightTone, string> = {
  start: "text-primary",
  focus: "text-warn-fg",
  build: "text-info-fg",
  celebrate: "text-ok-fg",
}

/** Insight-first hero: the one diagnosis and the one action that matters now. */
export function AnalyticsHero({ insight }: AnalyticsHeroProps) {
  const meta = TONE_META[insight.tone]
  const Icon = insight.tone === "celebrate" ? Flame : meta.icon

  return (
    <Card className="relative overflow-hidden p-0">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 320px at 5% -20%, var(--ambient-1), transparent 70%), radial-gradient(620px 260px at 98% 0%, var(--ambient-2), transparent 72%)",
        }}
      />
      <div className="relative flex flex-col gap-5 p-4 sm:p-6 lg:flex-row lg:items-end lg:justify-between lg:p-7">
        <div className="min-w-0 max-w-3xl">
          <div className="flex items-start gap-3">
            <IconBadge icon={Icon} size="md" tone={meta.tone} />
            <div className="min-w-0">
              <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${TONE_ACCENT[insight.tone]}`}>
                {insight.eyebrow}
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{insight.headline}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {insight.detail}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {insight.chips.map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/85 px-3 py-1.5 text-xs"
              >
                <span className="text-muted-foreground">{chip.label}</span>
                <span className="font-semibold text-foreground">{chip.value}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          <Button asChild size="lg" className="gap-2">
            <Link href={insight.cta.href}>
              {insight.cta.label}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          {insight.secondary ? (
            <Button asChild variant="outline" size="lg">
              <Link href={insight.secondary.href}>{insight.secondary.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  )
}
