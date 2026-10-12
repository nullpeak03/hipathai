"use client"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type Tone = "primary" | "info" | "ok" | "warn" | "danger" | "muted"

const TONES: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  info: "bg-info-bg text-info-fg",
  ok: "bg-ok-bg text-ok-fg",
  warn: "bg-warn-bg text-warn-fg",
  danger: "bg-danger-bg text-danger-fg",
  muted: "bg-muted text-muted-foreground",
}

const SIZES = {
  sm: { box: "w-9 h-9 rounded-xl", icon: "w-4 h-4" },
  md: { box: "w-12 h-12 rounded-2xl", icon: "w-6 h-6" },
  lg: { box: "w-16 h-16 rounded-2xl", icon: "w-8 h-8" },
} as const

/**
 * The one icon tile in the app: themed, crisp at every density, consistent
 * across empty states, locks, and illustrations. Replaces emoji pictographs.
 */
export function IconBadge({ icon: Icon, size = "md", tone = "primary", className }: {
  icon: LucideIcon
  size?: keyof typeof SIZES
  tone?: Tone
  className?: string
}) {
  const s = SIZES[size]
  return (
    <span className={cn("inline-flex items-center justify-center shrink-0", s.box, TONES[tone], className)}>
      <Icon className={s.icon} />
    </span>
  )
}
