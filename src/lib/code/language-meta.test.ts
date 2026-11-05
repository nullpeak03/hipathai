import { describe, it, expect } from "vitest"
import {
  LANGUAGE_IDS,
  LANGUAGE_META,
  defaultFileName,
  guessLanguageFromCode,
  isRunnableEditorLanguage,
  languageForPath,
  languageMeta,
  resolveLanguageId,
} from "./language-meta"

describe("language registry", () => {
  it("has unique ids and complete metadata", () => {
    expect(new Set(LANGUAGE_IDS).size).toBe(LANGUAGE_IDS.length)
    for (const id of LANGUAGE_IDS) {
      const meta = LANGUAGE_META[id]
      expect(meta.id, id).toBe(id)
      expect(meta.label.length, id).toBeGreaterThan(0)
      expect(meta.extension.length, id).toBeGreaterThan(0)
      expect(meta.fileName.length, id).toBeGreaterThan(0)
      expect(meta.template.trim().length, id).toBeGreaterThan(10)
    }
  })

  it("is editor-only only where Wandbox has no compiler", () => {
    const editorOnly = LANGUAGE_IDS.filter((id) => LANGUAGE_META[id].compiler === null)
    expect(editorOnly.sort()).toEqual(["dart", "kotlin"])
    expect(isRunnableEditorLanguage("csharp")).toBe(true)
    expect(isRunnableEditorLanguage("r")).toBe(true)
    expect(isRunnableEditorLanguage("kotlin")).toBe(false)
    expect(isRunnableEditorLanguage("brainfuck")).toBe(false)
  })

  it("resolves aliases and casing", () => {
    expect(resolveLanguageId("Python")).toBe("python")
    expect(resolveLanguageId("py")).toBe("python")
    expect(resolveLanguageId("c++")).toBe("cpp")
    expect(resolveLanguageId("C#")).toBe("csharp")
    expect(resolveLanguageId("cs")).toBe("csharp")
    expect(resolveLanguageId("nodejs")).toBe("javascript")
    expect(resolveLanguageId("kt")).toBe("kotlin")
    expect(resolveLanguageId("Rscript")).toBe("r")
    expect(resolveLanguageId("  ")).toBeNull()
    expect(resolveLanguageId(null)).toBeNull()
    expect(languageMeta("brainfuck")).toBeNull()
  })

  it("infers languages from file paths", () => {
    expect(languageForPath("main.py")).toBe("python")
    expect(languageForPath("src/app/index.ts")).toBe("typescript")
    expect(languageForPath("Program.cs")).toBe("csharp")
    expect(languageForPath("scripts/run.R")).toBe("r")
    expect(languageForPath("Main.kt")).toBe("kotlin")
    expect(languageForPath("notes", "ruby")).toBe("ruby")
    expect(languageForPath("main.unknown", "go")).toBe("go")
  })

  it("returns the default file name per language", () => {
    expect(defaultFileName("python")).toBe("main.py")
    expect(defaultFileName("C#")).toBe("Program.cs")
    expect(defaultFileName("nope")).toBe("main.txt")
  })

  it("guesses a language for legacy lesson drafts", () => {
    expect(guessLanguageFromCode('print("hi")')).toBe("python")
    expect(guessLanguageFromCode('console.log("hi")')).toBe("javascript")
    expect(guessLanguageFromCode("const x: number = 1")).toBe("typescript")
    expect(guessLanguageFromCode("#include <iostream>\nint main() {}")).toBe("cpp")
    expect(guessLanguageFromCode('using System;\nConsole.WriteLine("hi");')).toBe("csharp")
    expect(guessLanguageFromCode('puts "hi"')).toBe("ruby")
    expect(guessLanguageFromCode("SELECT * FROM users;")).toBe("sql")
    expect(guessLanguageFromCode("local x = 1\nprint(x)")).toBe("lua")
    expect(guessLanguageFromCode("x <- c(1, 2, 3)\nmean(x)")).toBe("r")
    expect(guessLanguageFromCode("")).toBe("python")
  })
})
