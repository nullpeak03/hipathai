"use client"
import { Button } from "./button"

type Props = {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

/** Styled replacement for window.confirm(). Render once, control via `open`. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40" onClick={() => { if (!busy) onClose() }} />
      <div className="relative bg-white rounded-2xl border shadow-xl max-w-sm w-full p-6">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-zinc-500 mt-2">{description}</p>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>{cancelLabel}</Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={busy}
            className={danger ? "bg-red-600 hover:bg-red-700" : ""}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
