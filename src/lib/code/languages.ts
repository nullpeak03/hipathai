// Lazy CodeMirror language loaders. Only the active file's mode is imported.
// Metadata stays in ./language-meta.ts so server routes never pull editor code.

import { LanguageSupport, StreamLanguage, type StreamParser } from "@codemirror/language"
import { resolveLanguageId, type EditorLanguageId } from "./language-meta"

const pending = new Map<EditorLanguageId, Promise<LanguageSupport>>()
const loaded = new Map<EditorLanguageId, LanguageSupport>()

/**
 * legacy-modes 6.5 depends on the standalone `@codemirror/streamparser` types;
 * the runtime shape is the same parser CodeMirror 6 expects. Wrap it so the
 * editor gets a LanguageSupport and TypeScript doesn't fight the duplicate
 * StringStream declaration.
 */
function stream(parser: unknown): LanguageSupport {
  return new LanguageSupport(StreamLanguage.define(parser as StreamParser<unknown>))
}

const LOADERS: Record<EditorLanguageId, () => Promise<LanguageSupport>> = {
  python: () => import("@codemirror/lang-python").then((m) => m.python()),
  javascript: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  typescript: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ typescript: true })),
  java: () => import("@codemirror/lang-java").then((m) => m.java()),
  c: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  cpp: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  go: () => import("@codemirror/lang-go").then((m) => m.go()),
  rust: () => import("@codemirror/lang-rust").then((m) => m.rust()),
  ruby: () => import("@codemirror/legacy-modes/mode/ruby").then((m) => stream(m.ruby)),
  php: () => import("@codemirror/lang-php").then((m) => m.php()),
  sql: () => import("@codemirror/lang-sql").then((m) => m.sql()),
  swift: () => import("@codemirror/legacy-modes/mode/swift").then((m) => stream(m.swift)),
  bash: () => import("@codemirror/legacy-modes/mode/shell").then((m) => stream(m.shell)),
  lua: () => import("@codemirror/legacy-modes/mode/lua").then((m) => stream(m.lua)),
  csharp: () => import("@codemirror/legacy-modes/mode/clike").then((m) => stream(m.csharp)),
  kotlin: () => import("@codemirror/legacy-modes/mode/clike").then((m) => stream(m.kotlin)),
  dart: () => import("@codemirror/legacy-modes/mode/clike").then((m) => stream(m.dart)),
  r: () => import("@codemirror/legacy-modes/mode/r").then((m) => stream(m.r)),
}

/** Already-imported mode, if any — lets a tab switch avoid a flash. */
export function getLoadedLanguage(language: string | null | undefined): LanguageSupport | null {
  const id = resolveLanguageId(language)
  return id ? loaded.get(id) ?? null : null
}

/** Import (once) the CodeMirror mode for a language. Unknown -> null. */
export function loadLanguage(language: string | null | undefined): Promise<LanguageSupport | null> {
  const id = resolveLanguageId(language)
  if (!id) return Promise.resolve(null)
  const ready = loaded.get(id)
  if (ready) return Promise.resolve(ready)
  const inFlight = pending.get(id)
  if (inFlight) return inFlight
  const next = LOADERS[id]()
    .then((mode) => {
      loaded.set(id, mode)
      return mode
    })
    .catch((error) => {
      pending.delete(id)
      throw error
    })
    .finally(() => {
      pending.delete(id)
    })
  pending.set(id, next)
  return next
}
