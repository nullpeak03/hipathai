// Local-first project persistence. Cloud sync (later phase) will mirror these
// snapshots through /api/code/projects; the local copy remains authoritative
// until a sync succeeds.

import {
  MAX_FILE_CHARS,
  MAX_FILES,
  MAX_PROJECT_CHARS,
  MAX_PROJECTS,
  createProject,
  newFile,
  normalizeProject,
  projectCharCount,
  uid,
  type CodeFile,
  type CodeProject,
} from "./project-model"
import {
  LANGUAGE_META,
  guessLanguageFromCode,
  resolveLanguageId,
  type EditorLanguageId,
} from "./language-meta"

export const WORKSPACE_INDEX_KEY = "hipath_code_workspace_v2"
export const PROJECT_KEY_PREFIX = "hipath_code_project_v2:"
export const LEGACY_IMPORT_MARKER = "hipath_code_legacy_imported_v1"
const LEGACY_KEY_PREFIX = "code-e:"
const LESSON_DRAFT_PREFIX = "hipath_code_draft:"

type WorkspaceIndex = {
  version: 2
  projectIds: string[]
  activeProjectId: string | null
}

export type ProjectSummary = {
  id: string
  title: string
  language: EditorLanguageId
  updatedAt: number
  fileCount: number
}

export type SaveResult = { ok: true } | { ok: false; error: string }

function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null
    return localStorage
  } catch {
    return null
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = storage()?.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): SaveResult {
  try {
    storage()?.setItem(key, JSON.stringify(value))
    return { ok: true }
  } catch {
    return { ok: false, error: "Local storage is full. Export this project, then delete an old one." }
  }
}

export function defaultIndex(): WorkspaceIndex {
  return { version: 2, projectIds: [], activeProjectId: null }
}

export function loadWorkspaceIndex(): WorkspaceIndex {
  const raw = readJson<Partial<WorkspaceIndex>>(WORKSPACE_INDEX_KEY)
  if (!raw || raw.version !== 2 || !Array.isArray(raw.projectIds)) return defaultIndex()
  return {
    version: 2,
    projectIds: raw.projectIds.filter((id): id is string => typeof id === "string"),
    activeProjectId: typeof raw.activeProjectId === "string" ? raw.activeProjectId : null,
  }
}

export function saveWorkspaceIndex(index: WorkspaceIndex): SaveResult {
  return writeJson(WORKSPACE_INDEX_KEY, {
    version: 2,
    projectIds: [...new Set(index.projectIds)].slice(0, MAX_PROJECTS),
    activeProjectId: index.activeProjectId,
  })
}

export function loadProject(projectId: string): CodeProject | null {
  const raw = readJson<unknown>(`${PROJECT_KEY_PREFIX}${projectId}`)
  return normalizeProject(raw)
}

export function saveProject(project: CodeProject): SaveResult {
  if (project.files.some((file) => file.content.length > MAX_FILE_CHARS)) {
    return { ok: false, error: "One file is over the 100,000-character limit. Export it and split it up." }
  }
  if (projectCharCount(project) > MAX_PROJECT_CHARS) {
    return { ok: false, error: "This project is over the 2 MB local limit. Export it and remove a large file." }
  }
  return writeJson(`${PROJECT_KEY_PREFIX}${project.id}`, project)
}

export function deleteLocalProject(projectId: string): void {
  try {
    storage()?.removeItem(`${PROJECT_KEY_PREFIX}${projectId}`)
  } catch {
    // best-effort
  }
  const index = loadWorkspaceIndex()
  const projectIds = index.projectIds.filter((id) => id !== projectId)
  saveWorkspaceIndex({
    ...index,
    projectIds,
    activeProjectId: index.activeProjectId === projectId ? (projectIds[0] ?? null) : index.activeProjectId,
  })
}

export function openProject(projectId: string): CodeProject | null {
  const project = loadProject(projectId)
  if (!project) return null
  const index = loadWorkspaceIndex()
  saveWorkspaceIndex({
    ...index,
    projectIds: [...new Set([projectId, ...index.projectIds])].slice(0, MAX_PROJECTS),
    activeProjectId: projectId,
  })
  return project
}

export function createLocalProject(language: EditorLanguageId): { project: CodeProject; result: SaveResult } {
  const project = createProject({ language })
  const result = saveProject(project)
  if (result.ok) {
    const index = loadWorkspaceIndex()
    saveWorkspaceIndex({
      ...index,
      projectIds: [...new Set([project.id, ...index.projectIds])].slice(0, MAX_PROJECTS),
      activeProjectId: project.id,
    })
  }
  return { project, result }
}

export function listLocalProjects(): ProjectSummary[] {
  const index = loadWorkspaceIndex()
  const out: ProjectSummary[] = []
  for (const id of index.projectIds) {
    const project = loadProject(id)
    if (!project) continue
    out.push({
      id: project.id,
      title: project.title,
      language: project.language,
      updatedAt: project.updatedAt,
      fileCount: project.files.length,
    })
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt)
}

/**
 * One-time import of the old standalone scratchpad keys (`code-e:<language>`)
 * and lesson drafts (`hipath_code_draft:*`). Original keys are left untouched
 * so a rollback still finds the drafts and lessons keep loading them.
 *
 * Lesson draft keys predate language metadata, so the language is inferred
 * from the saved code and the result is a read-only "Lesson drafts" project.
 * They remain editable through their original lesson blocks.
 */
export function importLegacyDrafts(): number {
  const store = storage()
  if (!store) return 0
  try {
    if (store.getItem(LEGACY_IMPORT_MARKER) === "1") return 0
    const standaloneKeys: string[] = []
    const lessonKeys: string[] = []
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (key?.startsWith(LEGACY_KEY_PREFIX)) standaloneKeys.push(key)
      else if (key?.startsWith(LESSON_DRAFT_PREFIX)) lessonKeys.push(key)
    }
    let imported = 0
    let failed = false
    const index = loadWorkspaceIndex()

    for (const key of standaloneKeys) {
      const languageId = resolveLanguageId(key.slice(LEGACY_KEY_PREFIX.length))
      const content = store.getItem(key)
      if (!languageId || !content?.trim()) continue
      const project = createProject({
        language: languageId,
        title: `Imported ${LANGUAGE_META[languageId].label}`,
        content,
        id: uid("p_legacy_"),
      })
      if (projectCharCount(project) > MAX_PROJECT_CHARS) {
        failed = true
        continue
      }
      if (!saveProject(project).ok) {
        failed = true
        continue
      }
      index.projectIds = [...new Set([project.id, ...index.projectIds])].slice(0, MAX_PROJECTS)
      imported++
    }

    // Prefer a real scratchpad import as the first project rather than the
    // read-only lesson-draft archive.
    if (!index.activeProjectId && index.projectIds[0]) index.activeProjectId = index.projectIds[0]

    if (lessonKeys.length > 0) {
      const files: CodeFile[] = []
      let projectLanguage: EditorLanguageId = "python"
      for (const key of lessonKeys) {
        if (files.length >= MAX_FILES) break
        const content = store.getItem(key)
        if (!content?.trim()) continue
        const language = guessLanguageFromCode(content)
        if (files.length === 0) projectLanguage = language
        const name = key.slice(LESSON_DRAFT_PREFIX.length).replace(/:/g, "-")
        files.push(newFile({ language, files, path: `lesson-drafts/${name}`, content }))
      }
      if (files.length > 0) {
        const base = createProject({
          language: projectLanguage,
          title: "Lesson drafts (imported)",
          id: uid("p_legacy_lessons_"),
        })
        const project: CodeProject = {
          ...base,
          files,
          activeFileId: (files[0] as CodeFile).id,
          readOnly: true,
        }
        if (projectCharCount(project) <= MAX_PROJECT_CHARS && saveProject(project).ok) {
          index.projectIds = [...new Set([project.id, ...index.projectIds])].slice(0, MAX_PROJECTS)
          imported++
        } else {
          failed = true
        }
      }
    }

    if (imported > 0) saveWorkspaceIndex(index)
    if (!failed) store.setItem(LEGACY_IMPORT_MARKER, "1")
    return imported
  } catch {
    return 0
  }
}

/** Load the last project, first valid project, or a fresh Python project. */
export function loadOrCreateWorkspace(preferredLanguage: EditorLanguageId = "python"): CodeProject {
  importLegacyDrafts()
  const index = loadWorkspaceIndex()
  const ordered = index.activeProjectId
    ? [index.activeProjectId, ...index.projectIds.filter((id) => id !== index.activeProjectId)]
    : index.projectIds
  for (const id of ordered) {
    const project = loadProject(id)
    if (project) {
      saveWorkspaceIndex({ ...index, activeProjectId: project.id })
      return project
    }
  }
  const { project } = createLocalProject(preferredLanguage)
  return project
}
