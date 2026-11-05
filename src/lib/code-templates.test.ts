import { describe, it, expect } from "vitest"
import { EDITOR_LANGUAGES, STARTER_TEMPLATES, isRunnableEditorLanguage } from "./code-templates"

describe("editor templates", () => {
  it("gives every listed language a non-trivial starter template", () => {
    for (const { id } of EDITOR_LANGUAGES) {
      const template = STARTER_TEMPLATES[id]
      expect(template.trim().length, id).toBeGreaterThan(10)
    }
  })
  it("runs every language except the editor-only ones", () => {
    const editorOnly = new Set(["kotlin", "dart"])
    for (const { id } of EDITOR_LANGUAGES) {
      expect(isRunnableEditorLanguage(id), id).toBe(!editorOnly.has(id))
    }
  })
  it("has unique language ids", () => {
    const ids = EDITOR_LANGUAGES.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
