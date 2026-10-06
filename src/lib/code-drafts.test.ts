import { describe, it, expect, vi, beforeEach } from "vitest"
import { draftKey, loadCodeDraft, saveCodeDraft, clearCodeDraft } from "./code-drafts"

function stubStorage() {
  const map = new Map<string, string>()
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v) },
    removeItem: (k: string) => { map.delete(k) },
  } as Storage)
  return map
}

describe("code drafts", () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })
  it("builds stable namespaced keys", () => {
    expect(draftKey("lesson-1", 0)).toBe("hipath_code_draft:lesson-1:0")
    expect(draftKey("lesson-1", "ex")).toBe("hipath_code_draft:lesson-1:ex")
  })
  it("round-trips drafts and clears them", () => {
    stubStorage()
    expect(loadCodeDraft("k")).toBeNull()
    saveCodeDraft("k", "x = 1")
    expect(loadCodeDraft("k")).toBe("x = 1")
    clearCodeDraft("k")
    expect(loadCodeDraft("k")).toBeNull()
  })
  it("refuses oversize drafts and survives missing storage", () => {
    stubStorage()
    saveCodeDraft("big", "x".repeat(25000))
    expect(loadCodeDraft("big")).toBeNull()
    vi.unstubAllGlobals()
    expect(loadCodeDraft("k")).toBeNull()
    expect(() => saveCodeDraft("k", "x")).not.toThrow()
    expect(() => clearCodeDraft("k")).not.toThrow()
  })
})
