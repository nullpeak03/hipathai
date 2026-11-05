"use client"

import { FileCode2, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CodeFile } from "@/lib/code/project-model"

export function EditorTabs({
  files,
  activeFileId,
  dirtyFileIds,
  onSelect,
  onClose,
  onNew,
  readOnly = false,
}: {
  files: CodeFile[]
  activeFileId: string
  dirtyFileIds: Set<string>
  onSelect: (fileId: string) => void
  onClose: (fileId: string) => void
  onNew: () => void
  readOnly?: boolean
}) {
  return (
    <div className="flex items-center gap-1 border-b border-border bg-card/60 min-w-0">
      <div role="tablist" aria-label="Open files" className="flex items-center gap-0.5 overflow-x-auto min-w-0 flex-1 px-1">
        {files.map((file) => {
          const active = file.id === activeFileId
          const dirty = dirtyFileIds.has(file.id)
          return (
            <div
              key={file.id}
              className={cn(
                "group flex items-center shrink-0 rounded-t-md border-b-2 text-xs",
                active
                  ? "border-primary bg-card text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(file.id)}
                onAuxClick={(event) => {
                  if (event.button === 1) {
                    event.preventDefault()
                    onClose(file.id)
                  }
                }}
                className="flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 max-w-[180px]"
                title={file.path}
              >
                <FileCode2 className={cn("w-3.5 h-3.5 shrink-0", active ? "text-primary" : "")} />
                <span className="truncate">{file.path.split("/").pop()}</span>
                {dirty ? <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-label="Unsaved changes" /> : null}
              </button>
              <button
                type="button"
                onClick={() => onClose(file.id)}
                aria-label={`Close ${file.path}`}
                className="p-1 mr-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )
        })}
      </div>
      <button
        type="button"
        onClick={onNew}
        aria-label="New file"
        title="New file"
        disabled={readOnly}
        className="p-1.5 mr-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 disabled:hidden"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
