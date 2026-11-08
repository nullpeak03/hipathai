"use client"

import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SaveBarProps = {
  dirty: boolean
  saving: boolean
  saved: boolean
  sectionLabel: string
  onSave: () => void
  onDiscard: () => void
}

export function SaveBar({ dirty, saving, saved, sectionLabel, onSave, onDiscard }: SaveBarProps) {
  if (!dirty && !saving && !saved) return null

  return (
    <div className="sticky bottom-4 z-20 mt-5" role="status" aria-live="polite">
      <div
        className={cn(
          "flex flex-col gap-3 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-4",
          dirty ? "border-warn-border" : "border-ok-border"
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
              dirty ? "bg-warn-bg text-warn-fg" : "bg-ok-bg text-ok-fg"
            )}
          >
            {dirty ? <span className="h-2 w-2 rounded-full bg-current" /> : <Check className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {dirty ? "Unsaved changes" : saving ? "Saving…" : "All changes saved"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {dirty ? `${sectionLabel} has updates that aren't saved yet.` : saving ? "Writing your preferences." : "Your preferences are up to date."}
            </p>
          </div>
        </div>
        {dirty ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={onDiscard} disabled={saving}>
              Discard
            </Button>
            <Button size="sm" onClick={onSave} disabled={saving} className="gap-1.5" title="Save changes (Ctrl/Cmd+S)">
              {saving ? "Saving…" : "Save changes"}
              <kbd className="hidden rounded border border-primary-foreground/30 px-1 text-[10px] font-normal opacity-80 lg:inline">
                ⌘S
              </kbd>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
