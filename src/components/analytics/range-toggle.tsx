"use client"

import { ANALYTICS_RANGES, ANALYTICS_RANGE_LABELS, type AnalyticsRange } from "@/lib/analytics-insights"
import { cn } from "@/lib/utils"

type AnalyticsRangeToggleProps = {
  value: AnalyticsRange
  onChange: (range: AnalyticsRange) => void
}

export function AnalyticsRangeToggle({ value, onChange }: AnalyticsRangeToggleProps) {
  return (
    <div
      className="inline-flex w-fit rounded-xl border border-border bg-card p-1"
      role="group"
      aria-label="Analytics time range"
    >
      {ANALYTICS_RANGES.map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => onChange(range)}
          aria-pressed={value === range}
          title={ANALYTICS_RANGE_LABELS[range]}
          className={cn(
            "min-h-[36px] rounded-lg px-3 text-xs font-semibold transition-colors sm:px-4",
            value === range
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {range}d
          <span className="sr-only"> — {ANALYTICS_RANGE_LABELS[range]}</span>
        </button>
      ))}
    </div>
  )
}
