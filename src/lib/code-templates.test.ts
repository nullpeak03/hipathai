import { describe, it, expect } from "vitest"
import { EDITOR_LANGUAGES, STARTER_TEMPLATES, isRunnableEditorLanguage } from "./code-templates"

describe("editor templates", () => {
  it("covers every listed language with a runnable template", () => {
    for (const { id } of EDITOR_LANGUAGES) {
      expect(isRunnableEditorLanguage(id), id).toBe(true)
      const t = STARTER_TEMPLATES[id]
      expect(t.trim().length, id).toBeGreaterThan(10)
    }
  })
  it("has unique language ids", () => {
    const ids = EDITOR_LANGUAGES.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
