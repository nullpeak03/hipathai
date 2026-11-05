// Editor preferences are separate from the global accessibility font size
// (`users.font_size`). Stored locally now; the cloud-sync phase adds the
// `users.code_editor_settings` mirror without changing this shape.

export type EditorSettings = {
  fontSize: number
  wrap: boolean
  tabSize: 2 | 4
  layout: "bottom" | "right"
  treeOpen: boolean
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 14,
  wrap: true,
  tabSize: 2,
  layout: "bottom",
  treeOpen: true,
}

const STORAGE_KEY = "hipath_code_settings_v2"
const MIN_FONT = 12
const MAX_FONT = 20

function clampFont(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return DEFAULT_EDITOR_SETTINGS.fontSize
  return Math.min(MAX_FONT, Math.max(MIN_FONT, Math.round(n)))
}

/** Normalize untrusted storage/API input into a valid settings object. */
export function normalizeEditorSettings(input: unknown): EditorSettings {
  const raw = (input && typeof input === "object" ? input : {}) as Partial<Record<keyof EditorSettings, unknown>>
  return {
    fontSize: clampFont(raw.fontSize),
    wrap: typeof raw.wrap === "boolean" ? raw.wrap : DEFAULT_EDITOR_SETTINGS.wrap,
    tabSize: raw.tabSize === 4 ? 4 : 2,
    layout: raw.layout === "right" ? "right" : "bottom",
    treeOpen: typeof raw.treeOpen === "boolean" ? raw.treeOpen : DEFAULT_EDITOR_SETTINGS.treeOpen,
  }
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null
    return localStorage
  } catch {
    return null
  }
}

export function loadEditorSettings(): EditorSettings {
  try {
    const raw = storage()?.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_EDITOR_SETTINGS
    return normalizeEditorSettings(JSON.parse(raw))
  } catch {
    return DEFAULT_EDITOR_SETTINGS
  }
}

export function saveEditorSettings(settings: EditorSettings): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(normalizeEditorSettings(settings)))
  } catch {
    // Storage full/private mode — settings are best-effort.
  }
}
