// Pure project/file model. No browser or React dependencies so every rule is
// unit-testable. Phase 1 is local-only; `cloudId` is reserved for sync.

import {
  LANGUAGE_META,
  defaultFileName,
  languageForPath,
  resolveLanguageId,
  type EditorLanguageId,
} from "./language-meta"

export const MAX_PROJECTS = 25
export const MAX_FILES = 20
export const MAX_FILE_CHARS = 100_000
export const MAX_PROJECT_CHARS = 2_000_000
export const MAX_PATH_CHARS = 200

export type CodeFile = {
  id: string
  path: string
  language: EditorLanguageId
  content: string
  isEntry?: boolean
}

export type CodeProject = {
  id: string
  title: string
  language: EditorLanguageId
  files: CodeFile[]
  activeFileId: string
  createdAt: number
  updatedAt: number
  /** Set after the cloud-sync migration; local projects leave it undefined. */
  cloudId?: string
  /** Imported legacy lesson drafts are a read-only snapshot. */
  readOnly?: boolean
}

export function uid(prefix = ""): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}${crypto.randomUUID()}`
    }
  } catch {
    // fall through
  }
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/** Clean user input into a safe relative path (folders allowed). */
export function sanitizePath(input: string): string {
  const segments = input
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) =>
      segment
        .trim()
        .replace(/[^A-Za-z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^[-.]+|[-.]+$/g, "")
    )
    .filter(Boolean)
  return segments.join("/")
}

export function ensureExtension(path: string, language: EditorLanguageId): string {
  const name = path.split("/").pop() ?? path
  if (name.includes(".")) return path
  return `${path}.${LANGUAGE_META[language].extension}`
}

export function uniquePath(desired: string, files: CodeFile[], ignoreId?: string): string {
  const taken = new Set(files.filter((file) => file.id !== ignoreId).map((file) => file.path))
  if (!taken.has(desired)) return desired
  const slash = desired.lastIndexOf("/")
  const folder = slash >= 0 ? desired.slice(0, slash + 1) : ""
  const name = slash >= 0 ? desired.slice(slash + 1) : desired
  const dot = name.lastIndexOf(".")
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ""
  for (let n = 2; n < 1000; n++) {
    const candidate = `${folder}${stem}-${n}${ext}`
    if (!taken.has(candidate)) return candidate
  }
  return `${folder}${stem}-${Date.now().toString(36)}${ext}`
}

export function validatePath(path: string, files: CodeFile[], ignoreId?: string): string | null {
  if (!path) return "Enter a file name."
  if (path.length > MAX_PATH_CHARS) return `File paths are limited to ${MAX_PATH_CHARS} characters.`
  if (path.startsWith("/") || path.endsWith("/")) return "File paths can’t start or end with a slash."
  if (path.split("/").some((segment) => segment === "." || segment === "..")) {
    return "File paths can’t contain “.” or “..” segments."
  }
  if (files.some((file) => file.id !== ignoreId && file.path === path)) {
    return "A file with that name already exists."
  }
  return null
}

export function newFile(input: {
  language: EditorLanguageId
  files: CodeFile[]
  path?: string
  id?: string
  content?: string
  isEntry?: boolean
}): CodeFile {
  const language = input.language
  const base = input.path ? ensureExtension(sanitizePath(input.path), language) : defaultFileName(language)
  return {
    id: input.id ?? uid("f_"),
    path: uniquePath(base, input.files),
    language,
    content: input.content ?? LANGUAGE_META[language].template,
    ...(input.isEntry ? { isEntry: true } : {}),
  }
}

export function createProject(input: {
  language: EditorLanguageId
  title?: string
  content?: string
  path?: string
  id?: string
  fileId?: string
  now?: number
}): CodeProject {
  const now = input.now ?? Date.now()
  const language = input.language
  const file = newFile({
    language,
    files: [],
    path: input.path,
    id: input.fileId,
    content: input.content,
  })
  return {
    id: input.id ?? uid("p_"),
    title: input.title?.trim() || `Untitled ${LANGUAGE_META[language].label}`,
    language,
    files: [file],
    activeFileId: file.id,
    createdAt: now,
    updatedAt: now,
  }
}

export function addFile(project: CodeProject, file: CodeFile, now = Date.now()): CodeProject {
  if (project.files.length >= MAX_FILES) return project
  return { ...project, files: [...project.files, file], activeFileId: file.id, updatedAt: now }
}

export function removeFile(project: CodeProject, fileId: string, now = Date.now()): CodeProject {
  if (project.files.length <= 1) return project
  const index = project.files.findIndex((file) => file.id === fileId)
  if (index < 0) return project
  const files = project.files.filter((file) => file.id !== fileId)
  const activeFileId =
    project.activeFileId === fileId
      ? (files[Math.min(index, files.length - 1)] as CodeFile).id
      : project.activeFileId
  return { ...project, files, activeFileId, updatedAt: now }
}

export function renameFile(
  project: CodeProject,
  fileId: string,
  requestedPath: string,
  now = Date.now()
): { project: CodeProject; error?: string } {
  const file = project.files.find((candidate) => candidate.id === fileId)
  if (!file) return { project, error: "File not found." }
  const path = ensureExtension(sanitizePath(requestedPath), file.language)
  const error = validatePath(path, project.files, fileId)
  if (error) return { project, error }
  return {
    project: {
      ...project,
      files: project.files.map((candidate) => (candidate.id === fileId ? { ...candidate, path } : candidate)),
      updatedAt: now,
    },
  }
}

export function updateFileContent(
  project: CodeProject,
  fileId: string,
  content: string,
  now = Date.now()
): CodeProject {
  const file = project.files.find((candidate) => candidate.id === fileId)
  if (!file || file.content === content) return project
  return {
    ...project,
    files: project.files.map((candidate) => (candidate.id === fileId ? { ...candidate, content } : candidate)),
    updatedAt: now,
  }
}

export function setActiveFile(project: CodeProject, fileId: string, now = Date.now()): CodeProject {
  if (!project.files.some((file) => file.id === fileId) || project.activeFileId === fileId) return project
  return { ...project, activeFileId: fileId, updatedAt: now }
}

export function activeFile(project: CodeProject): CodeFile {
  return project.files.find((file) => file.id === project.activeFileId) ?? (project.files[0] as CodeFile)
}

export function projectCharCount(project: CodeProject): number {
  return project.files.reduce((total, file) => total + file.content.length, 0)
}

export function projectLanguageForFile(path: string, fallback: EditorLanguageId): EditorLanguageId {
  return languageForPath(path, fallback)
}

/** True when a path's extension disagrees with the file's selected language. */
export function pathLanguageMismatch(path: string, language: EditorLanguageId): boolean {
  const resolved = languageForPath(path, language)
  return resolved !== language
}

export function normalizeProject(input: unknown): CodeProject | null {
  if (!input || typeof input !== "object") return null
  const raw = input as Record<string, unknown>
  const language = resolveLanguageId(raw.language as string)
  if (!raw.id || typeof raw.id !== "string" || !language) return null
  if (!Array.isArray(raw.files) || raw.files.length === 0) return null
  const files: CodeFile[] = []
  for (const entry of raw.files) {
    if (!entry || typeof entry !== "object") return null
    const file = entry as Record<string, unknown>
    const fileLanguage = resolveLanguageId(file.language as string)
    if (!file.id || typeof file.id !== "string" || !file.path || typeof file.path !== "string" || !fileLanguage) {
      return null
    }
    files.push({
      id: file.id,
      path: file.path,
      language: fileLanguage,
      content: typeof file.content === "string" ? file.content : "",
      ...(file.isEntry === true ? { isEntry: true } : {}),
    })
  }
  const active = typeof raw.activeFileId === "string" && files.some((file) => file.id === raw.activeFileId)
    ? raw.activeFileId
    : (files[0] as CodeFile).id
  return {
    id: raw.id,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title : `Untitled ${LANGUAGE_META[language].label}`,
    language,
    files,
    activeFileId: active,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
    ...(typeof raw.cloudId === "string" ? { cloudId: raw.cloudId } : {}),
    ...(raw.readOnly === true ? { readOnly: true } : {}),
  }
}
