import type { MasteryBand } from "@/lib/analytics-insights"

export const BAND_META: Record<MasteryBand, { label: string; bar: string; text: string }> = {
  mastered: { label: "Mastered", bar: "bg-ok-fg", text: "text-ok-fg" },
  proficient: { label: "Proficient", bar: "bg-primary", text: "text-primary" },
  developing: { label: "Developing", bar: "bg-warn-fg", text: "text-warn-fg" },
  "needs-practice": { label: "Needs practice", bar: "bg-danger-fg", text: "text-danger-fg" },
}

export function bandBar(score: number): string {
  if (score >= 90) return BAND_META.mastered.bar
  if (score >= 70) return BAND_META.proficient.bar
  if (score >= 50) return BAND_META.developing.bar
  return BAND_META["needs-practice"].bar
}
