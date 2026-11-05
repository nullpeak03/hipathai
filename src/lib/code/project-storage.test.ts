import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  LEGACY_IMPORT_MARKER,
  PROJECT_KEY_PREFIX,
  WORKSPACE_INDEX_KEY,
  createLocalProject,
  deleteLocalProject,
  importLegacyDrafts,
  listLocalProjects,
  loadOrCreateWorkspace,
  loadProject,
  loadWorkspaceIndex,
  openProject,
  saveProject,
  saveWorkspaceIndex,
} from "./project-storage"
import { MAX_FILE_CHARS, MAX_FILES, MAX_PROJECT_CHARS, createProject, updateFileContent } from "./project-model"

class MemoryStorage implements Storage {
  private map = new Map<string, string>()

  get length(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value))
  }
}

let store: MemoryStorage

beforeEach(() => {
  vi.unstubAllGlobals()
  store = new MemoryStorage()
  vi.stubGlobal("localStorage", store)
})

describe("project storage", () => {
  it("creates, saves, loads, lists, and deletes local projects", () => {
    const first = createLocalProject("python")
    expect(first.result.ok).toBe(true)
    expect(loadProject(first.project.id)?.title).toBe(first.project.title)

    const second = createLocalProject("typescript")
    const renamed = {
      ...second.project,
      title: "Newer project",
      updatedAt: first.project.updatedAt + 10_000,
    }
    expect(saveProject(renamed).ok).toBe(true)

    const list = listLocalProjects()
    expect(list.map((entry) => entry.title)).toEqual(["Newer project", first.project.title])
    expect(list[0]).toMatchObject({ language: "typescript", fileCount: 1 })

    expect(openProject(first.project.id)?.id).toBe(first.project.id)
    expect(loadWorkspaceIndex().activeProjectId).toBe(first.project.id)

    deleteLocalProject(first.project.id)
    expect(loadProject(first.project.id)).toBeNull()
    expect(loadWorkspaceIndex().activeProjectId).toBe(second.project.id)
    expect(listLocalProjects()).toHaveLength(1)
  })

  it("imports legacy standalone drafts and lesson drafts once", () => {
    store.setItem("code-e:python", 'print("legacy")')
    store.setItem("code-e:cpp", "int main() { return 0; }")
    store.setItem("code-e:unknown", "ignored")
    store.setItem("code-e:kotlin", 'fun main() { println("hi") }')
    store.setItem("hipath_code_draft:lesson-1:0", 'console.log("lesson")')
    store.setItem("hipath_code_draft:lesson-2:ex", "SELECT * FROM users;")
    store.setItem("code-e:empty", "   ")

    expect(importLegacyDrafts()).toBe(4)
    const titles = listLocalProjects().map((entry) => entry.title).sort()
    expect(titles).toEqual([
      "Imported C++",
      "Imported Kotlin",
      "Imported Python",
      "Lesson drafts (imported)",
    ])

    const lessonProject = listLocalProjects().find((entry) => entry.title === "Lesson drafts (imported)")
    expect(lessonProject).toMatchObject({ fileCount: 2 })
    const loaded = lessonProject ? loadProject(lessonProject.id) : null
    expect(loaded?.readOnly).toBe(true)
    expect(loaded?.files.map((file) => file.language)).toEqual(["javascript", "sql"])
    expect(loaded?.files.map((file) => file.path)).toEqual([
      "lesson-drafts/lesson-1-0.js",
      "lesson-drafts/lesson-2-ex.sql",
    ])

    expect(store.getItem("code-e:python")).toBe('print("legacy")')
    expect(store.getItem("hipath_code_draft:lesson-1:0")).toBe('console.log("lesson")')
    expect(store.getItem(LEGACY_IMPORT_MARKER)).toBe("1")

    store.setItem("code-e:ruby", 'puts "later"')
    expect(importLegacyDrafts()).toBe(0)
    expect(listLocalProjects()).toHaveLength(4)
    expect(loadOrCreateWorkspace().title).not.toBe("Lesson drafts (imported)")
  })

  it("loads the active project, or creates one when storage is empty", () => {
    const created = loadOrCreateWorkspace()
    expect(created.language).toBe("python")
    expect(listLocalProjects()).toHaveLength(1)

    const other = createLocalProject("rust")
    expect(loadOrCreateWorkspace().id).toBe(other.project.id)

    openProject(created.id)
    expect(loadOrCreateWorkspace().id).toBe(created.id)
  })

  it("falls back to a fresh workspace when stored data is corrupt", () => {
    store.setItem(WORKSPACE_INDEX_KEY, "{bad")
    store.setItem(`${PROJECT_KEY_PREFIX}bad`, "{bad")
    expect(loadWorkspaceIndex()).toMatchObject({ projectIds: [], activeProjectId: null })
    expect(loadProject("bad")).toBeNull()
    expect(loadOrCreateWorkspace().language).toBe("python")
  })

  it("caps indexing and refuses oversized projects", () => {
    saveWorkspaceIndex({
      version: 2,
      projectIds: ["a", "a", "b"],
      activeProjectId: "b",
    })
    expect(loadWorkspaceIndex()).toMatchObject({ projectIds: ["a", "b"], activeProjectId: "b" })

    const big = createProject({ language: "python" })
    const manyFiles = Array.from({ length: MAX_FILES + 1 }, (_, index) => ({
      id: `f${index}`,
      path: `file-${index}.py`,
      language: "python" as const,
      content: "x".repeat(MAX_FILE_CHARS),
    }))
    const oversized = { ...big, files: manyFiles, activeFileId: manyFiles[0].id }
    expect(oversized.files.reduce((total, file) => total + file.content.length, 0)).toBeGreaterThan(MAX_PROJECT_CHARS)
    const result = saveProject(oversized)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/2 MB/i)

    const largeFile = updateFileContent(big, big.activeFileId, "x".repeat(MAX_FILE_CHARS + 1))
    const fileResult = saveProject(largeFile)
    expect(fileResult.ok).toBe(false)
    if (!fileResult.ok) expect(fileResult.error).toMatch(/100,000/i)
  })

  it("survives a full or unavailable storage backend", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied")
      },
      setItem: () => {
        throw new Error("full")
      },
      removeItem: () => {
        throw new Error("denied")
      },
      key: () => null,
      length: 0,
      clear: () => undefined,
    } as Storage)

    expect(loadWorkspaceIndex()).toMatchObject({ projectIds: [] })
    expect(loadOrCreateWorkspace().language).toBe("python")
    expect(saveProject(createProject({ language: "go" })).ok).toBe(false)
    expect(importLegacyDrafts()).toBe(0)
  })
})
