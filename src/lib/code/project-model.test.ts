import { describe, it, expect } from "vitest"
import {
  MAX_FILES,
  activeFile,
  addFile,
  createProject,
  ensureExtension,
  newFile,
  normalizeProject,
  pathLanguageMismatch,
  projectCharCount,
  removeFile,
  renameFile,
  sanitizePath,
  setActiveFile,
  uniquePath,
  updateFileContent,
  validatePath,
  type CodeProject,
} from "./project-model"

function project(): CodeProject {
  return createProject({ language: "python", id: "p1", fileId: "f1", now: 1000 })
}

describe("path helpers", () => {
  it("sanitizes unsafe path segments", () => {
    expect(sanitizePath("  src//My File.py  ")).toBe("src/My-File.py")
    expect(sanitizePath("../evil.py")).toBe("evil.py")
    expect(sanitizePath("a/./b.py")).toBe("a/b.py")
    expect(sanitizePath("")).toBe("")
  })

  it("adds the language extension only when missing", () => {
    expect(ensureExtension("main", "python")).toBe("main.py")
    expect(ensureExtension("lib/util", "typescript")).toBe("lib/util.ts")
    expect(ensureExtension("main.txt", "python")).toBe("main.txt")
    expect(ensureExtension("Program", "csharp")).toBe("Program.cs")
  })

  it("makes duplicate paths unique", () => {
    const files = [
      newFile({ language: "python", files: [], path: "main.py", id: "a" }),
      newFile({ language: "python", files: [], path: "lib/util.py", id: "b" }),
    ]
    expect(uniquePath("main.py", files)).toBe("main-2.py")
    expect(uniquePath("lib/util.py", files)).toBe("lib/util-2.py")
    expect(uniquePath("new.py", files)).toBe("new.py")
    expect(uniquePath("main.py", files, "a")).toBe("main.py")
  })

  it("validates file names and duplicates", () => {
    const files = [newFile({ language: "python", files: [], path: "main.py", id: "a" })]
    expect(validatePath("", files)).toMatch(/name/i)
    expect(validatePath("/main.py", files)).toMatch(/slash/i)
    expect(validatePath("main.py/", files)).toMatch(/slash/i)
    expect(validatePath("a/../main.py", files)).toMatch(/segments/i)
    expect(validatePath("main.py", files)).toMatch(/already exists/i)
    expect(validatePath("main.py", files, "a")).toBeNull()
    expect(validatePath("app.py", files)).toBeNull()
  })
})

describe("project model", () => {
  it("creates a deterministic project with one starter file", () => {
    const created = project()
    expect(created).toMatchObject({
      id: "p1",
      title: "Untitled Python",
      language: "python",
      activeFileId: "f1",
      createdAt: 1000,
      updatedAt: 1000,
    })
    expect(created.files).toHaveLength(1)
    expect(created.files[0]).toMatchObject({ id: "f1", path: "main.py", language: "python" })
    expect(created.files[0].content).toContain("Hello from HiPath AI")
  })

  it("keeps at least one file and updates the active tab on delete", () => {
    const created = project()
    const second = newFile({ language: "python", files: created.files, id: "f2" })
    const withTwo = addFile(created, second, 2000)
    expect(withTwo.files).toHaveLength(2)
    expect(withTwo.activeFileId).toBe("f2")

    const removed = removeFile(withTwo, "f2", 3000)
    expect(removed.files.map((file) => file.id)).toEqual(["f1"])
    expect(removed.activeFileId).toBe("f1")
    expect(removed.updatedAt).toBe(3000)

    expect(removeFile(removed, "f1")).toBe(removed)
  })

  it("renames with extension and rejects duplicates", () => {
    const created = project()
    const withTwo = addFile(
      created,
      newFile({ language: "python", files: created.files, path: "util", id: "f2" }),
      2000
    )
    const renamed = renameFile(withTwo, "f2", "lib/helper", 3000)
    expect(renamed.error).toBeUndefined()
    expect(renamed.project.files.find((file) => file.id === "f2")?.path).toBe("lib/helper.py")
    expect(renamed.project.updatedAt).toBe(3000)

    const duplicate = renameFile(renamed.project, "f2", "main.py")
    expect(duplicate.error).toMatch(/already exists/i)
    expect(duplicate.project).toBe(renamed.project)
    expect(renameFile(created, "missing", "x.py").error).toMatch(/not found/i)
  })

  it("updates content and active file with no-ops preserved", () => {
    const created = project()
    const updated = updateFileContent(created, "f1", "print('hi')", 2000)
    expect(activeFile(updated).content).toBe("print('hi')")
    expect(updated.updatedAt).toBe(2000)
    expect(updateFileContent(updated, "f1", "print('hi')", 3000)).toBe(updated)
    expect(updateFileContent(updated, "missing", "x")).toBe(updated)

    const other = addFile(updated, newFile({ language: "python", files: updated.files, id: "f2" }), 3000)
    const selected = setActiveFile(other, "f1", 4000)
    expect(selected.activeFileId).toBe("f1")
    expect(setActiveFile(selected, "f1")).toBe(selected)
    expect(setActiveFile(selected, "missing")).toBe(selected)
  })

  it("enforces the file cap", () => {
    let created = project()
    for (let index = 1; index < MAX_FILES; index++) {
      created = addFile(created, newFile({ language: "python", files: created.files }))
    }
    expect(created.files).toHaveLength(MAX_FILES)
    const extra = newFile({ language: "python", files: created.files })
    expect(addFile(created, extra).files).toHaveLength(MAX_FILES)
  })

  it("counts characters, flags path mismatches, and normalizes storage input", () => {
    const created = project()
    expect(projectCharCount(created)).toBe(created.files[0].content.length)
    expect(pathLanguageMismatch("main.py", "python")).toBe(false)
    expect(pathLanguageMismatch("main.py", "javascript")).toBe(true)

    const normalized = normalizeProject({
      id: "p9",
      language: "py",
      files: [{ id: "f9", path: "main.py", language: "python", content: "x = 1" }],
      activeFileId: "missing",
      createdAt: 5,
      updatedAt: 6,
      cloudId: "c1",
    })
    expect(normalized).toMatchObject({
      id: "p9",
      language: "python",
      activeFileId: "f9",
      cloudId: "c1",
    })
    const readOnly = normalizeProject({
      id: "p10",
      language: "python",
      files: [{ id: "f10", path: "main.py", language: "python" }],
      readOnly: true,
    })
    expect(readOnly?.readOnly).toBe(true)
    expect(normalizeProject(null)).toBeNull()
    expect(normalizeProject({ id: "p", language: "python", files: [] })).toBeNull()
    expect(normalizeProject({ id: "p", language: "unknown", files: [{ id: "f", path: "a.py" }] })).toBeNull()
    expect(
      normalizeProject({ id: "p", language: "python", files: [{ id: "f", path: "a.py", language: "python" }] })
    ).toMatchObject({ title: "Untitled Python", files: [{ content: "" }] })
  })
})
