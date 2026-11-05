"use client"

import { EDITOR_LANGUAGES, LANGUAGE_META } from "@/lib/code/language-meta"
import { MAX_PROJECTS } from "@/lib/code/project-model"

export function NewProjectDialog({
  open,
  onClose,
  onCreate,
  atLimit,
}: {
  open: boolean
  onClose: () => void
  onCreate: (language: (typeof EDITOR_LANGUAGES)[number]["id"]) => void
  atLimit: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="New project">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border border-border shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-auto">
        <h3 className="font-semibold">New project</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a language. Your current project stays saved on this device.
        </p>
        {atLimit ? (
          <p className="mt-3 text-xs text-warn-fg bg-warn-bg border border-warn-border rounded-lg p-2">
            You have reached the {MAX_PROJECTS}-project local limit. Delete an old project first.
          </p>
        ) : null}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-5">
          {EDITOR_LANGUAGES.map((language) => {
            const runnable = LANGUAGE_META[language.id].compiler !== null
            return (
              <button
                key={language.id}
                type="button"
                disabled={atLimit}
                onClick={() => onCreate(language.id)}
                className="rounded-xl border border-border px-3 py-2.5 text-left hover:border-primary/50 hover:bg-muted disabled:opacity-50"
              >
                <span className="block text-sm font-medium">{language.label}</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">
                  {runnable ? `Runs · .${LANGUAGE_META[language.id].extension}` : "Editor only"}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex justify-end mt-5">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-border text-sm hover:bg-muted">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
