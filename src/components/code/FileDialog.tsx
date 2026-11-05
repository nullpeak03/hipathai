"use client"

import { useEffect, useRef } from "react"

export function FileDialog({
  open,
  mode,
  value,
  error,
  onChange,
  onSubmit,
  onClose,
}: {
  open: boolean
  mode: "new" | "rename"
  value: string
  error?: string
  onChange: (value: string) => void
  onSubmit: () => void
  onClose: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
    return () => clearTimeout(timer)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={mode === "new" ? "New file" : "Rename file"}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
        className="relative bg-card rounded-2xl border border-border shadow-xl max-w-sm w-full p-6"
      >
        <h3 className="font-semibold">{mode === "new" ? "New file" : "Rename file"}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Use folders if you like, for example <span className="font-mono">src/utils.py</span>.
        </p>
        <label className="block mt-4">
          <span className="text-xs font-medium text-muted-foreground">File name</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            spellCheck={false}
            autoComplete="off"
            className="mt-1 w-full h-10 rounded-lg border border-border bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        {error ? <p className="mt-2 text-xs text-danger-fg">{error}</p> : null}
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="h-9 px-3 rounded-lg border border-border text-sm hover:bg-muted">
            Cancel
          </button>
          <button type="submit" className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover">
            {mode === "new" ? "Create file" : "Save name"}
          </button>
        </div>
      </form>
    </div>
  )
}
