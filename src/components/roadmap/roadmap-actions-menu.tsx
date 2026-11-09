"use client"

import { useEffect, useRef, useState } from "react"
import { MoreHorizontal, Pencil, Sparkles, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type RoadmapActionsMenuProps = {
  publishing: boolean
  replanning: boolean
  deleting: boolean
  onEdit: () => void
  onPublish: () => void
  onSuggestChange: () => void
  onDelete: () => void
}

export function RoadmapActionsMenu({
  publishing,
  replanning,
  deleting,
  onEdit,
  onPublish,
  onSuggestChange,
  onDelete,
}: RoadmapActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus()
    })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("mousedown", onPointerDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("mousedown", onPointerDown)
    }
  }, [open])

  const run = (action: () => void) => {
    setOpen(false)
    action()
  }

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary disabled:opacity-50"

  return (
    <div ref={containerRef} className="relative">
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="roadmap-actions-menu"
        aria-label="Roadmap actions"
        title="Roadmap actions"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </Button>

      {open ? (
        <div
          ref={menuRef}
          id="roadmap-actions-menu"
          role="menu"
          aria-label="Roadmap actions"
          className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-xl"
        >
          <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Manage
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onEdit)}
            className={itemClass}
          >
            <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Edit roadmap
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onSuggestChange)}
            disabled={replanning}
            className={itemClass}
          >
            <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            {replanning ? "Finding changes…" : "Suggest a change"}
          </button>

          <div className="my-1 border-t border-border" role="separator" />

          <button
            type="button"
            role="menuitem"
            onClick={() => run(onPublish)}
            disabled={publishing}
            className={itemClass}
          >
            <Upload className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            {publishing ? "Requesting…" : "Request publish"}
          </button>

          <div className="my-1 border-t border-border" role="separator" />

          <button
            type="button"
            role="menuitem"
            onClick={() => run(onDelete)}
            disabled={deleting}
            className={cn(itemClass, "text-danger-fg hover:bg-danger-bg focus-visible:outline-danger-fg")}
          >
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
            {deleting ? "Deleting…" : "Delete roadmap"}
          </button>
        </div>
      ) : null}
    </div>
  )
}
