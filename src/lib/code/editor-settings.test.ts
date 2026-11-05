import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  DEFAULT_EDITOR_SETTINGS,
  loadEditorSettings,
  normalizeEditorSettings,
  saveEditorSettings,
} from "./editor-settings"

function stubStorage() {
  const map = new Map<string, string>()
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
  } as Storage)
  return map
}

describe("editor settings", () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it("normalizes untrusted input and clamps the font size", () => {
    expect(normalizeEditorSettings(null)).toEqual(DEFAULT_EDITOR_SETTINGS)
    expect(normalizeEditorSettings({ fontSize: 5 }).fontSize).toBe(12)
    expect(normalizeEditorSettings({ fontSize: 99 }).fontSize).toBe(20)
    expect(normalizeEditorSettings({ fontSize: 15.6 }).fontSize).toBe(16)
    expect(normalizeEditorSettings({ fontSize: "huge" }).fontSize).toBe(DEFAULT_EDITOR_SETTINGS.fontSize)
  })

  it("only accepts supported layout/tab values", () => {
    const parsed = normalizeEditorSettings({
      wrap: false,
      tabSize: 8,
      layout: "diagonal",
      treeOpen: false,
    })
    expect(parsed).toEqual({ ...DEFAULT_EDITOR_SETTINGS, wrap: false, tabSize: 2, layout: "bottom", treeOpen: false })
    expect(normalizeEditorSettings({ tabSize: 4, layout: "right" })).toMatchObject({ tabSize: 4, layout: "right" })
  })

  it("round-trips through storage", () => {
    stubStorage()
    expect(loadEditorSettings()).toEqual(DEFAULT_EDITOR_SETTINGS)
    saveEditorSettings({ fontSize: 18, wrap: false, tabSize: 4, layout: "right", treeOpen: false })
    expect(loadEditorSettings()).toEqual({
      fontSize: 18,
      wrap: false,
      tabSize: 4,
      layout: "right",
      treeOpen: false,
    })
  })

  it("falls back to defaults on corrupt or missing storage", () => {
    const map = stubStorage()
    map.set("hipath_code_settings_v2", "{not json")
    expect(loadEditorSettings()).toEqual(DEFAULT_EDITOR_SETTINGS)
    vi.unstubAllGlobals()
    expect(loadEditorSettings()).toEqual(DEFAULT_EDITOR_SETTINGS)
  })
})
