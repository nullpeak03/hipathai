"use client"

import { Check, FileCode2, Plus, Trash2 } from "lucide-react"
import { LANGUAGE_META } from "@/lib/code/language-meta"
import type { ProjectSummary } from "@/lib/code/project-storage"

function updatedLabel(at: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60000))
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function ProjectMenu({
  open,
  onClose,
  projects,
  activeProjectId,
  onSelect,
  onNew,
  onDelete,
  atLimit,
}: {
  open: boolean
  onClose: () => void
  projects: ProjectSummary[]
  activeProjectId: string
  onSelect: (projectId: string) => void
  onNew: () => void
  onDelete: (projectId: string) => void
  atLimit: boolean
}) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden="true" />
      <div
        role="menu"
        aria-label="Projects"
        className="absolute left-0 top-full mt-2 z-40 w-80 max-w-[90vw] rounded-xl border border-border bg-card shadow-xl p-1.5"
      >
        <div className="px-2 py-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
          LOCAL PROJECTS
        </div>
        <div className="max-h-72 overflow-auto">
          {projects.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">No projects yet.</p>
          ) : (
            projects.map((project) => {
              const active = project.id === activeProjectId
              return (
                <div key={project.id} className="group flex items-center gap-1 rounded-lg hover:bg-muted">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => onSelect(project.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 px-2 py-2 text-left"
                  >
                    <FileCode2 className={active ? "w-4 h-4 shrink-0 text-primary" : "w-4 h-4 shrink-0 text-muted-foreground"} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium truncate">{project.title}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {LANGUAGE_META[project.language].label} · {project.fileCount} file{project.fileCount === 1 ? "" : "s"} · {updatedLabel(project.updatedAt)}
                      </span>
                    </span>
                    {active ? <Check className="w-3.5 h-3.5 text-primary shrink-0" /> : null}
                  </button>
                  {!active ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => onDelete(project.id)}
                      aria-label={`Delete ${project.title}`}
                      title="Delete project"
                      className="p-1.5 mr-1 rounded-md text-muted-foreground hover:text-danger-fg hover:bg-card opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
        <div className="border-t border-border mt-1 pt-1">
          <button
            type="button"
            role="menuitem"
            disabled={atLimit}
            onClick={onNew}
            className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> New project
          </button>
        </div>
      </div>
    </>
  )
}
