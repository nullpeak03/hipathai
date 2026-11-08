"use client"

import { Check, Loader2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { IconBadge } from "@/components/ui/icon-badge"
import { cn } from "@/lib/utils"

export type SaveStatus = "idle" | "dirty" | "saving" | "saved"

type SectionHeaderProps = {
  icon: LucideIcon
  title: string
  description: string
  status: SaveStatus
}

const STATUS_COPY: Record<Exclude<SaveStatus, "idle">, string> = {
  dirty: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
}

export function SectionHeader({ icon, title, description, status }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <IconBadge icon={icon} size="md" tone="primary" />
        <div className="min-w-0">
          <h2
            id="settings-section-heading"
            tabIndex={-1}
            className="text-lg font-semibold tracking-tight outline-none sm:text-xl"
          >
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {status !== "idle" ? (
        <span
          aria-live="polite"
          aria-label={STATUS_COPY[status]}
          title={STATUS_COPY[status]}
          className={cn(
            "mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
            status === "dirty" && "border-warn-border bg-warn-bg text-warn-fg",
            status === "saving" && "border-border bg-muted text-muted-foreground",
            status === "saved" && "border-ok-border bg-ok-bg text-ok-fg"
          )}
        >
          {status === "saved" ? (
            <Check className="h-3 w-3" aria-hidden />
          ) : status === "saving" ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          )}
          <span className="hidden sm:inline">{STATUS_COPY[status]}</span>
        </span>
      ) : null}
    </div>
  )
}
