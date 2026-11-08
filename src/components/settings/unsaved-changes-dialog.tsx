"use client"

import { Button } from "@/components/ui/button"

type UnsavedChangesDialogProps = {
  open: boolean
  destination: string
  saving: boolean
  onSave: () => void
  onDiscard: () => void
  onStay: () => void
}

/** Three-way guard for leaving a settings section with unsaved changes. */
export function UnsavedChangesDialog({
  open,
  destination,
  saving,
  onSave,
  onDiscard,
  onStay,
}: UnsavedChangesDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-label="Unsaved changes"
    >
      <div className="absolute inset-0 bg-black/40" onClick={() => { if (!saving) onStay() }} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-6">
        <h3 className="font-semibold">Save before you continue?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{destination}</span> has unsaved changes. Save them
          before you continue, or discard them.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="sm" onClick={onStay} disabled={saving}>
            Stay here
          </Button>
          <Button variant="outline" size="sm" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save & continue"}
          </Button>
        </div>
      </div>
    </div>
  )
}
