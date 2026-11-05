import { describe, it, expect, afterEach, vi } from "vitest"
import { downloadTextFile, fileNameFromPath, safeFileStem } from "./export"

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("export helpers", () => {
  it("takes the basename of a path", () => {
    expect(fileNameFromPath("src/lib/main.py")).toBe("main.py")
    expect(fileNameFromPath("README")).toBe("README")
    expect(fileNameFromPath("folder/")).toBe("main.txt")
    expect(fileNameFromPath("")).toBe("main.txt")
  })

  it("builds a filesystem-safe export stem", () => {
    expect(safeFileStem("My Project!")).toBe("my-project")
    expect(safeFileStem("  Trail Mix  ")).toBe("trail-mix")
    expect(safeFileStem("--")).toBe("hipath-project")
    expect(safeFileStem("")).toBe("hipath-project")
  })

  it("downloads text through a temporary anchor", () => {
    const anchor = { href: "", download: "", rel: "", click: vi.fn(), remove: vi.fn() }
    const appendChild = vi.fn()
    const createElement = vi.fn(() => anchor)
    const createObjectURL = vi.fn(() => "blob:test")
    const revokeObjectURL = vi.fn()
    vi.stubGlobal("document", { createElement, body: { appendChild } })
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL })
    vi.useFakeTimers()

    downloadTextFile("main.py", 'print("hi")')

    expect(createElement).toHaveBeenCalledWith("a")
    expect(anchor.href).toBe("blob:test")
    expect(anchor.download).toBe("main.py")
    expect(anchor.rel).toBe("noopener")
    expect(appendChild).toHaveBeenCalledWith(anchor)
    expect(anchor.click).toHaveBeenCalledOnce()
    expect(anchor.remove).toHaveBeenCalledOnce()

    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test")
  })

  it("does nothing during server rendering", () => {
    expect(() => downloadTextFile("main.py", "x")).not.toThrow()
  })
})
