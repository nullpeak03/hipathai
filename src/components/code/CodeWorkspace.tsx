"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronDown,
  Download,
  Loader2,
  PanelLeft,
  Play,
  Settings2,
  X,
} from "lucide-react"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"
import {
  DEFAULT_EDITOR_SETTINGS,
  loadEditorSettings,
  saveEditorSettings,
  type EditorSettings,
} from "@/lib/code/editor-settings"
import {
  isRunnableEditorLanguage,
  LANGUAGE_META,
  defaultFileName,
  type EditorLanguageId,
} from "@/lib/code/language-meta"
import {
  MAX_FILES,
  MAX_PROJECTS,
  activeFile as getActiveFile,
  addFile,
  ensureExtension,
  newFile,
  removeFile,
  renameFile,
  sanitizePath,
  setActiveFile,
  uniquePath,
  updateFileContent,
  validatePath,
  type CodeFile,
  type CodeProject,
} from "@/lib/code/project-model"
import {
  createLocalProject,
  deleteLocalProject,
  listLocalProjects,
  loadOrCreateWorkspace,
  openProject,
  saveProject,
  type ProjectSummary,
} from "@/lib/code/project-storage"
import { downloadTextFile, fileNameFromPath } from "@/lib/code/export"
import { CodeMirrorEditor, type CodeMirrorEditorHandle } from "./CodeMirrorEditor"
import { EditorTabs } from "./EditorTabs"
import { FileDialog } from "./FileDialog"
import { NewProjectDialog } from "./NewProjectDialog"
import { OutputPanel } from "./OutputPanel"
import { ProjectMenu } from "./ProjectMenu"
import { ProjectTree } from "./ProjectTree"
import { SettingsPopover } from "./SettingsPopover"
import { StdinPanel, useStdinAnswers } from "./StdinPanel"
import { ProUpgradeDialog } from "./panel-shell"
import { useCodeRunner } from "./use-code-run"

type SaveState = "saved" | "saving" | "error"
type FileDialogState = {
  mode: "new" | "rename"
  fileId?: string
  value: string
  error?: string
}

export function CodeWorkspace() {
  const editorRef = useRef<CodeMirrorEditorHandle>(null)
  const firstAnswerRef = useRef<HTMLInputElement>(null)
  const projectRef = useRef<CodeProject | null>(null)

  const [project, setProject] = useState<CodeProject | null>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [openFileIds, setOpenFileIds] = useState<string[]>([])
  const [dirtyFileIds, setDirtyFileIds] = useState<Set<string>>(new Set())
  const [settings, setSettings] = useState<EditorSettings>(DEFAULT_EDITOR_SETTINGS)
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const [saveState, setSaveState] = useState<SaveState>("saved")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [fileDialog, setFileDialog] = useState<FileDialogState | null>(null)
  const [deleteFileTarget, setDeleteFileTarget] = useState<CodeFile | null>(null)
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null)
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false)
  const [outputOpen, setOutputOpen] = useState(true)
  const [upgraded, setUpgraded] = useState(false)
  const [lastRunFileId, setLastRunFileId] = useState<string | null>(null)
  const [lastRunCode, setLastRunCode] = useState<string | null>(null)

  projectRef.current = project

  const active = project ? getActiveFile(project) : null
  const stdin = useStdinAnswers(active?.language ?? "python", active?.content ?? "")
  const runner = useCodeRunner({
    onUpgrade: () => setUpgraded(true),
    onNeedsStdin: () => {
      stdin.setOpen(true)
      setTimeout(() => firstAnswerRef.current?.focus(), 0)
    },
  })

  const refreshProjects = useCallback(() => {
    setProjects(listLocalProjects())
  }, [])

  useEffect(() => {
    setSettings(loadEditorSettings())
    const loaded = loadOrCreateWorkspace()
    setProject(loaded)
    setOpenFileIds([loaded.activeFileId])
    setProjects(listLocalProjects())
  }, [])

  const saveNow = useCallback(() => {
    const current = projectRef.current
    if (!current) return
    setSaveState("saving")
    const result = saveProject(current)
    if (result.ok) {
      setSaveState("saved")
      setSaveError(null)
      setDirtyFileIds(new Set())
    } else {
      setSaveState("error")
      setSaveError(result.error)
    }
  }, [])

  // Local autosave: 500ms after the last edit, plus tab-hide/unload flushes.
  useEffect(() => {
    if (!project) return
    const timer = setTimeout(saveNow, 500)
    return () => clearTimeout(timer)
  }, [project, saveNow])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") saveNow()
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("beforeunload", saveNow)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("beforeunload", saveNow)
    }
  }, [saveNow])

  const updateSettings = (patch: Partial<EditorSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch }
      saveEditorSettings(next)
      return next
    })
  }

  const patchProject = (updater: (current: CodeProject) => CodeProject) => {
    setProject((current) => (current ? updater(current) : current))
  }

  const resetTransient = () => {
    runner.reset()
    stdin.reset()
    setLastRunFileId(null)
    setLastRunCode(null)
    setOutputOpen(true)
  }

  const selectFile = (fileId: string) => {
    if (!project) return
    setProject(setActiveFile(project, fileId))
    setOpenFileIds((current) => (current.includes(fileId) ? current : [...current, fileId]))
    setMobileTreeOpen(false)
  }

  const closeTab = (fileId: string) => {
    if (!project || openFileIds.length <= 1) return
    const index = openFileIds.indexOf(fileId)
    const next = openFileIds.filter((id) => id !== fileId)
    setOpenFileIds(next)
    if (project.activeFileId === fileId) {
      const fallback = next[Math.min(Math.max(index, 0), next.length - 1)]
      if (fallback) selectFile(fallback)
    }
  }

  const switchProject = (projectId: string) => {
    const next = openProject(projectId)
    if (!next) {
      setSaveError("That project could not be loaded.")
      return
    }
    setProject(next)
    setOpenFileIds([next.activeFileId])
    setProjectMenuOpen(false)
    setMobileTreeOpen(false)
    setSaveError(null)
    resetTransient()
  }

  const startNewProject = (language: EditorLanguageId) => {
    if (projects.length >= MAX_PROJECTS) {
      setNewProjectOpen(false)
      setSaveError(`You have reached the ${MAX_PROJECTS}-project local limit. Delete an old project first.`)
      return
    }
    const { project: created, result } = createLocalProject(language)
    if (!result.ok) {
      setSaveError(result.error)
      return
    }
    setProject(created)
    setOpenFileIds([created.activeFileId])
    setNewProjectOpen(false)
    setSaveError(null)
    refreshProjects()
    resetTransient()
  }

  const deleteProject = () => {
    if (!deleteProjectId || !project) return
    const removingActive = deleteProjectId === project.id
    deleteLocalProject(deleteProjectId)
    const remaining = listLocalProjects()
    setProjects(remaining)
    setDeleteProjectId(null)
    if (!removingActive) return
    if (remaining[0]) {
      switchProject(remaining[0].id)
      return
    }
    const fallback = createLocalProject(project.language)
    setProject(fallback.project)
    setOpenFileIds([fallback.project.activeFileId])
    setSaveError(fallback.result.ok ? null : fallback.result.error)
    refreshProjects()
    resetTransient()
  }

  const openNewFileDialog = () => {
    if (!project || !active || project.readOnly) return
    if (project.files.length >= MAX_FILES) {
      setSaveError(`A project can hold up to ${MAX_FILES} files.`)
      return
    }
    setFileDialog({
      mode: "new",
      value: uniquePath(defaultFileName(active.language), project.files),
    })
  }

  const openRenameDialog = (file: CodeFile) => {
    if (project?.readOnly) return
    setFileDialog({ mode: "rename", fileId: file.id, value: file.path })
  }

  const submitFileDialog = () => {
    if (!project || !fileDialog) return
    if (fileDialog.mode === "new") {
      if (!active) return
      if (project.files.length >= MAX_FILES) {
        setFileDialog({ ...fileDialog, error: `A project can hold up to ${MAX_FILES} files.` })
        return
      }
      const path = ensureExtension(sanitizePath(fileDialog.value), active.language)
      const error = validatePath(path, project.files)
      if (error) {
        setFileDialog({ ...fileDialog, error })
        return
      }
      const file = newFile({ language: active.language, files: project.files, path })
      const next = addFile(project, file)
      setProject(next)
      setOpenFileIds((current) => [...current, file.id])
      setFileDialog(null)
      return
    }
    if (!fileDialog.fileId) return
    const result = renameFile(project, fileDialog.fileId, fileDialog.value)
    if (result.error) {
      setFileDialog({ ...fileDialog, error: result.error })
      return
    }
    setProject(result.project)
    setFileDialog(null)
  }

  const requestDeleteFile = (file: CodeFile) => {
    if (!project || project.readOnly || project.files.length <= 1) {
      if (!project?.readOnly) setSaveError("A project needs at least one file.")
      return
    }
    setDeleteFileTarget(file)
  }

  const deleteFile = () => {
    if (!project || !deleteFileTarget) return
    const next = removeFile(project, deleteFileTarget.id)
    setProject(next)
    setOpenFileIds((current) => {
      const remaining = current.filter((id) => id !== deleteFileTarget.id)
      return remaining.includes(next.activeFileId) ? remaining : [...remaining, next.activeFileId]
    })
    setDeleteFileTarget(null)
  }

  const run = () => {
    if (!active || !isRunnableEditorLanguage(active.language)) return
    setOutputOpen(true)
    setLastRunFileId(active.id)
    setLastRunCode(active.content)
    void runner.run(active.language, active.content, stdin.stdinText)
  }

  const exportActiveFile = () => {
    if (!active) return
    downloadTextFile(fileNameFromPath(active.path), active.content)
  }

  // Workspace-level shortcuts (the editor owns Mod-Enter / Mod-S while focused).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      const target = event.target as HTMLElement | null
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable
      if (typing) return
      const key = event.key.toLowerCase()
      if (key === "b") {
        event.preventDefault()
        updateSettings({ treeOpen: !settings.treeOpen })
      } else if (key === "`") {
        event.preventDefault()
        setOutputOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [settings.treeOpen])

  const openFiles = useMemo(() => {
    if (!project) return []
    const byId = new Map(project.files.map((file) => [file.id, file]))
    const files = openFileIds.map((id) => byId.get(id)).filter((file): file is CodeFile => Boolean(file))
    if (!files.some((file) => file.id === project.activeFileId)) {
      files.push(getActiveFile(project))
    }
    return files
  }, [project, openFileIds])

  if (!project || !active) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center bg-app text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading workspace…
      </div>
    )
  }

  const language = LANGUAGE_META[active.language]
  const canRun = isRunnableEditorLanguage(active.language)
  const readOnly = project.readOnly === true
  const running = runner.output.state === "running"
  const errorLine =
    lastRunFileId === active.id && lastRunCode === active.content ? runner.errorLine : null
  const lastRunFile = lastRunFileId
    ? project.files.find((file) => file.id === lastRunFileId) ?? null
    : null
  const saveLabel = saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Saved locally"

  const tree = (
    <ProjectTree
      files={project.files}
      activeFileId={project.activeFileId}
      onSelect={selectFile}
      onNewFile={openNewFileDialog}
      onRename={openRenameDialog}
      onDelete={requestDeleteFile}
      readOnly={readOnly}
      className="h-full"
    />
  )

  return (
    <div className="h-[calc(100vh-3.5rem)] min-h-[32rem] flex flex-col bg-app">
      {/* Workspace header */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-2 sm:px-3 h-11 shrink-0">
        <button
          type="button"
          onClick={() => setMobileTreeOpen(true)}
          aria-label="Open files"
          className="md:hidden p-2 -ml-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <div className="relative flex items-center gap-1 min-w-0">
          <input
            value={project.title}
            readOnly={readOnly}
            onChange={(event) => {
              if (readOnly) return
              patchProject((current) => ({ ...current, title: event.target.value, updatedAt: Date.now() }))
            }}
            onBlur={() => {
              if (readOnly) return
              if (!project.title.trim()) {
                patchProject((current) => ({
                  ...current,
                  title: `Untitled ${LANGUAGE_META[current.language].label}`,
                }))
              }
            }}
            aria-label="Project title"
            className="min-w-0 w-28 sm:w-52 bg-transparent text-sm font-semibold px-1.5 py-1 rounded-md border border-transparent hover:border-border focus:border-border focus:outline-none focus:ring-2 focus:ring-primary/20 read-only:hover:border-transparent"
          />
          <button
            type="button"
            onClick={() => {
              setProjects(listLocalProjects())
              setProjectMenuOpen((open) => !open)
            }}
            aria-label="Open project menu"
            aria-expanded={projectMenuOpen}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <ProjectMenu
            open={projectMenuOpen}
            onClose={() => setProjectMenuOpen(false)}
            projects={projects}
            activeProjectId={project.id}
            onSelect={switchProject}
            onNew={() => {
              setProjectMenuOpen(false)
              setNewProjectOpen(true)
            }}
            onDelete={(projectId) => {
              setProjectMenuOpen(false)
              setDeleteProjectId(projectId)
            }}
            atLimit={projects.length >= MAX_PROJECTS}
          />
        </div>

        <span className="hidden lg:inline text-[11px] text-muted-foreground">{language.label}</span>
        <span className="hidden sm:inline text-[11px] text-muted-foreground" aria-live="polite">
          {saveLabel}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={run}
            disabled={!canRun || running}
            title={canRun ? "Run active file (Ctrl/Cmd + Enter)" : `${language.label} is editor-only for now`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary-hover disabled:opacity-50 disabled:pointer-events-none"
          >
            <Play className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{running ? "Running…" : "Run"}</span>
          </button>
          <button
            type="button"
            onClick={exportActiveFile}
            title="Download active file"
            aria-label="Download active file"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Export</span>
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setSettingsOpen((open) => !open)}
              aria-label="Editor settings"
              aria-expanded={settingsOpen}
              className="p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Settings2 className="w-4 h-4" />
            </button>
            <SettingsPopover
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              settings={settings}
              onChange={updateSettings}
            />
          </div>
        </div>
      </div>

      {saveError ? (
        <div role="alert" className="flex items-start justify-between gap-3 px-3 py-1.5 text-xs bg-danger-bg text-danger-fg border-b border-danger-border">
          <span>{saveError}</span>
          <button type="button" onClick={() => setSaveError(null)} aria-label="Dismiss error">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}

      {readOnly ? (
        <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] bg-info-bg text-info-fg border-b border-info-border">
          Imported lesson drafts are a read-only snapshot. Edit the original code block in its lesson to make changes.
        </div>
      ) : null}

      <div className="flex flex-1 min-h-0">
        {settings.treeOpen ? (
          <aside className="hidden md:flex w-56 shrink-0 border-r border-border bg-card">
            {tree}
          </aside>
        ) : null}

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <EditorTabs
            files={openFiles}
            activeFileId={active.id}
            dirtyFileIds={dirtyFileIds}
            onSelect={selectFile}
            onClose={closeTab}
            onNew={openNewFileDialog}
            readOnly={readOnly}
          />

          <div className={cn("flex-1 min-h-0 flex", settings.layout === "right" ? "flex-col lg:flex-row" : "flex-col")}>
            <div className="flex-1 flex flex-col min-h-0">
              <div className="relative flex-1 min-h-0">
                <CodeMirrorEditor
                  ref={editorRef}
                  fileId={active.id}
                  value={active.content}
                  language={active.language}
                  settings={settings}
                  onChange={(value) => {
                    setDirtyFileIds((current) => new Set(current).add(active.id))
                    patchProject((current) => updateFileContent(current, active.id, value))
                  }}
                  onCursor={(line, column) => setCursor({ line, column })}
                  onRun={run}
                  onSave={saveNow}
                  readOnly={readOnly}
                  fill
                  errorLine={errorLine}
                  errorMessage={runner.errorMessage}
                  ariaLabel={`${language.label} code editor`}
                  className="h-full"
                />
                {!canRun ? (
                  <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground border border-border">
                    {language.label} is editor-only for now — you can still edit and export.
                  </div>
                ) : null}
              </div>

              {stdin.show ? (
                <div className="shrink-0 border-t border-border bg-card px-3 pb-2">
                  <StdinPanel
                    show={stdin.show}
                    answerCount={stdin.answerCount}
                    answers={stdin.answers}
                    label={stdin.label}
                    setAnswer={stdin.setAnswer}
                    onHide={() => stdin.setOpen(false)}
                    onShow={() => stdin.setOpen(true)}
                    onRun={run}
                    firstAnswerRef={firstAnswerRef}
                    needsStdin={stdin.needsStdin}
                  />
                </div>
              ) : null}
            </div>

            {outputOpen ? (
              <div
                className={cn(
                  "flex flex-col min-h-0 bg-card",
                  settings.layout === "right"
                    ? "h-56 border-t border-border lg:h-auto lg:w-[38%] lg:border-t-0 lg:border-l"
                    : "h-56 border-t border-border"
                )}
              >
                <div className="flex items-center justify-between px-3 py-1 border-b border-border shrink-0">
                  <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">
                    OUTPUT{lastRunFile ? ` · ${fileNameFromPath(lastRunFile.path)}` : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">Wandbox · no secrets</span>
                    <button
                      type="button"
                      onClick={() => setOutputOpen(false)}
                      aria-label="Hide output"
                      className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-auto">
                  <OutputPanel
                    output={runner.output}
                    outputTab={runner.outputTab}
                    setOutputTab={runner.setOutputTab}
                    history={runner.history}
                    errorLine={errorLine}
                    onJumpToLine={(line) => editorRef.current?.jumpToLine(line)}
                    onClear={runner.reset}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-3 py-1 text-[10px] text-muted-foreground shrink-0">
            <span className="truncate">
              {language.label} · Ln {cursor.line}, Col {cursor.column} · Tab {settings.tabSize} · {active.path}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {!outputOpen ? (
                <button type="button" onClick={() => setOutputOpen(true)} className="hover:text-foreground underline">
                  Show output
                </button>
              ) : null}
              <span>{saveLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile file drawer */}
      {mobileTreeOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileTreeOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-app border-r border-border shadow-xl flex flex-col">
            <div className="flex items-center justify-between h-11 px-3 border-b border-border">
              <span className="text-sm font-semibold">Files</span>
              <button
                type="button"
                onClick={() => setMobileTreeOpen(false)}
                aria-label="Close files"
                className="p-2 rounded-md hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0">{tree}</div>
          </aside>
        </div>
      ) : null}

      <FileDialog
        open={fileDialog !== null}
        mode={fileDialog?.mode ?? "new"}
        value={fileDialog?.value ?? ""}
        error={fileDialog?.error}
        onChange={(value) => setFileDialog((current) => (current ? { ...current, value, error: undefined } : current))}
        onSubmit={submitFileDialog}
        onClose={() => setFileDialog(null)}
      />

      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreate={startNewProject}
        atLimit={projects.length >= MAX_PROJECTS}
      />

      <ConfirmDialog
        open={deleteFileTarget !== null}
        title="Delete file?"
        description={`“${deleteFileTarget?.path ?? ""}” will be removed from this project. This can’t be undone.`}
        confirmLabel="Delete file"
        danger
        onConfirm={deleteFile}
        onClose={() => setDeleteFileTarget(null)}
      />

      <ConfirmDialog
        open={deleteProjectId !== null}
        title="Delete project?"
        description="This project and its local files will be deleted from this device. Export anything you want to keep first."
        confirmLabel="Delete project"
        danger
        onConfirm={deleteProject}
        onClose={() => setDeleteProjectId(null)}
      />

      <ProUpgradeDialog open={upgraded} onClose={() => setUpgraded(false)} />
    </div>
  )
}
