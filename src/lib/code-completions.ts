// Curated autocompletion for the in-lesson code editor.
//
// Real language servers (pyright/TS in WASM) are far too heavy for a lesson
// page, so suggestions come from three cheap, high-signal sources:
//   1. reserved words for the language,
//   2. the builtins / standard library a learner actually reaches for,
//   3. identifiers already present in the snippet they are editing.
// Pure and framework-free so it is unit-testable; the editor wires it into
// CodeMirror's completion source (see components/pro/code-panels.tsx).

export type CompletionKind = "keyword" | "function" | "method" | "class" | "local"

export type CodeCompletion = {
  label: string
  kind: CompletionKind
  detail?: string
}

type Entry = [string, CompletionKind] | [string, CompletionKind, string]

const PYTHON: Entry[] = [
  ["def", "keyword"], ["class", "keyword"], ["return", "keyword"], ["if", "keyword"],
  ["elif", "keyword"], ["else", "keyword"], ["for", "keyword"], ["while", "keyword"],
  ["try", "keyword"], ["except", "keyword"], ["finally", "keyword"], ["with", "keyword"],
  ["as", "keyword"], ["import", "keyword"], ["from", "keyword"], ["lambda", "keyword"],
  ["yield", "keyword"], ["global", "keyword"], ["nonlocal", "keyword"], ["pass", "keyword"],
  ["break", "keyword"], ["continue", "keyword"], ["raise", "keyword"], ["assert", "keyword"],
  ["async", "keyword"], ["await", "keyword"], ["not", "keyword"], ["and", "keyword"],
  ["or", "keyword"], ["is", "keyword"], ["in", "keyword"], ["None", "keyword"],
  ["True", "keyword"], ["False", "keyword"], ["self", "keyword"],
  ["print", "function", "output"], ["input", "function", "reads a line"],
  ["len", "function"], ["range", "function"], ["int", "function"], ["float", "function"],
  ["str", "function"], ["bool", "function"], ["list", "function"], ["dict", "function"],
  ["set", "function"], ["tuple", "function"], ["sum", "function"], ["min", "function"],
  ["max", "function"], ["abs", "function"], ["round", "function"], ["sorted", "function"],
  ["enumerate", "function"], ["zip", "function"], ["map", "function"], ["filter", "function"],
  ["any", "function"], ["all", "function"], ["type", "function"], ["isinstance", "function"],
  ["open", "function"], ["reversed", "function"], ["pow", "function"], ["format", "function"],
  ["append", "method"], ["pop", "method"], ["insert", "method"], ["remove", "method"],
  ["items", "method"], ["keys", "method"], ["values", "method"], ["get", "method"],
  ["split", "method"], ["join", "method"], ["strip", "method"], ["replace", "method"],
  ["startswith", "method"], ["endswith", "method"], ["upper", "method"], ["lower", "method"],
  ["count", "method"], ["index", "method"], ["sort", "method"], ["update", "method"],
  ["list", "class"], ["dict", "class"], ["set", "class"], ["tuple", "class"],
  ["Exception", "class"], ["ValueError", "class"], ["TypeError", "class"],
]

const JAVASCRIPT: Entry[] = [
  ["const", "keyword"], ["let", "keyword"], ["var", "keyword"], ["function", "keyword"],
  ["return", "keyword"], ["if", "keyword"], ["else", "keyword"], ["for", "keyword"],
  ["while", "keyword"], ["switch", "keyword"], ["case", "keyword"], ["break", "keyword"],
  ["continue", "keyword"], ["class", "keyword"], ["extends", "keyword"], ["new", "keyword"],
  ["this", "keyword"], ["async", "keyword"], ["await", "keyword"], ["try", "keyword"],
  ["catch", "keyword"], ["finally", "keyword"], ["throw", "keyword"], ["typeof", "keyword"],
  ["instanceof", "keyword"], ["import", "keyword"], ["export", "keyword"],
  ["default", "keyword"], ["null", "keyword"], ["undefined", "keyword"],
  ["true", "keyword"], ["false", "keyword"], ["of", "keyword"], ["in", "keyword"],
  ["console", "class", "console.log"], ["Math", "class"], ["JSON", "class"],
  ["Array", "class"], ["Object", "class"], ["String", "class"], ["Number", "class"],
  ["Boolean", "class"], ["Promise", "class"], ["Map", "class"], ["Set", "class"],
  ["Date", "class"], ["RegExp", "class"], ["Error", "class"], ["Symbol", "class"],
  ["parseInt", "function"], ["parseFloat", "function"], ["isNaN", "function"],
  ["setTimeout", "function"], ["setInterval", "function"], ["fetch", "function"],
  ["push", "method"], ["pop", "method"], ["shift", "method"], ["unshift", "method"],
  ["slice", "method"], ["splice", "method"], ["map", "method"], ["filter", "method"],
  ["reduce", "method"], ["forEach", "method"], ["find", "method"], ["findIndex", "method"],
  ["includes", "method"], ["indexOf", "method"], ["join", "method"], ["split", "method"],
  ["replace", "method"], ["replaceAll", "method"], ["toUpperCase", "method"],
  ["toLowerCase", "method"], ["trim", "method"], ["startsWith", "method"],
  ["endsWith", "method"], ["keys", "method"], ["values", "method"], ["entries", "method"],
  ["log", "method"], ["error", "method"], ["warn", "method"],
]

const JAVA: Entry[] = [
  ["public", "keyword"], ["private", "keyword"], ["protected", "keyword"],
  ["static", "keyword"], ["final", "keyword"], ["void", "keyword"], ["class", "keyword"],
  ["interface", "keyword"], ["extends", "keyword"], ["implements", "keyword"],
  ["new", "keyword"], ["return", "keyword"], ["if", "keyword"], ["else", "keyword"],
  ["for", "keyword"], ["while", "keyword"], ["do", "keyword"], ["switch", "keyword"],
  ["case", "keyword"], ["break", "keyword"], ["continue", "keyword"], ["try", "keyword"],
  ["catch", "keyword"], ["finally", "keyword"], ["throw", "keyword"], ["throws", "keyword"],
  ["package", "keyword"], ["import", "keyword"], ["this", "keyword"], ["super", "keyword"],
  ["int", "keyword"], ["long", "keyword"], ["double", "keyword"], ["float", "keyword"],
  ["char", "keyword"], ["boolean", "keyword"], ["var", "keyword"], ["null", "keyword"],
  ["true", "keyword"], ["false", "keyword"], ["String", "class"], ["Integer", "class"],
  ["Double", "class"], ["Boolean", "class"], ["ArrayList", "class"], ["List", "class"],
  ["HashMap", "class"], ["Map", "class"], ["Set", "class"], ["HashSet", "class"],
  ["Scanner", "class"], ["System", "class"], ["Math", "class"], ["Exception", "class"],
  ["println", "method"], ["printf", "method"], ["add", "method"], ["get", "method"],
  ["size", "method"], ["length", "method"], ["equals", "method"], ["toString", "method"],
]

const CPP: Entry[] = [
  ["#include", "keyword"], ["using", "keyword"], ["namespace", "keyword"],
  ["std", "class"], ["int", "keyword"], ["long", "keyword"], ["double", "keyword"],
  ["float", "keyword"], ["char", "keyword"], ["bool", "keyword"], ["void", "keyword"],
  ["auto", "keyword"], ["const", "keyword"], ["static", "keyword"], ["struct", "keyword"],
  ["class", "keyword"], ["public", "keyword"], ["private", "keyword"], ["template", "keyword"],
  ["for", "keyword"], ["while", "keyword"], ["if", "keyword"], ["else", "keyword"],
  ["switch", "keyword"], ["case", "keyword"], ["break", "keyword"], ["continue", "keyword"],
  ["return", "keyword"], ["true", "keyword"], ["false", "keyword"], ["nullptr", "keyword"],
  ["cout", "class"], ["cin", "class"], ["endl", "class"], ["vector", "class"],
  ["string", "class"], ["map", "class"], ["set", "class"], ["pair", "class"],
  ["printf", "function"], ["push_back", "method"], ["pop_back", "method"], ["size", "method"],
  ["begin", "method"], ["end", "method"], ["find", "method"], ["at", "method"],
]

const GO: Entry[] = [
  ["package", "keyword"], ["import", "keyword"], ["func", "keyword"], ["return", "keyword"],
  ["if", "keyword"], ["else", "keyword"], ["for", "keyword"], ["range", "keyword"],
  ["switch", "keyword"], ["case", "keyword"], ["default", "keyword"], ["break", "keyword"],
  ["continue", "keyword"], ["defer", "keyword"], ["go", "keyword"], ["struct", "keyword"],
  ["interface", "keyword"], ["map", "keyword"], ["chan", "keyword"], ["var", "keyword"],
  ["const", "keyword"], ["type", "keyword"], ["nil", "keyword"], ["true", "keyword"],
  ["false", "keyword"], ["make", "function"], ["new", "function"], ["len", "function"],
  ["append", "function"], ["cap", "function"], ["copy", "function"], ["panic", "function"],
  ["recover", "function"], ["delete", "function"], ["close", "function"], ["string", "class"],
  ["int", "class"], ["error", "class"], ["fmt", "class"],
  ["Println", "method"], ["Printf", "method"], ["Sprint", "method"], ["Errorf", "method"],
  ["Read", "method"], ["Write", "method"], ["String", "method"], ["Error", "method"],
]

const RUST: Entry[] = [
  ["fn", "keyword"], ["let", "keyword"], ["mut", "keyword"], ["const", "keyword"],
  ["static", "keyword"], ["struct", "keyword"], ["enum", "keyword"], ["trait", "keyword"],
  ["impl", "keyword"], ["for", "keyword"], ["while", "keyword"], ["loop", "keyword"],
  ["if", "keyword"], ["else", "keyword"], ["match", "keyword"], ["return", "keyword"],
  ["break", "keyword"], ["continue", "keyword"], ["use", "keyword"], ["mod", "keyword"],
  ["pub", "keyword"], ["crate", "keyword"], ["self", "keyword"], ["Some", "keyword"],
  ["None", "keyword"], ["Ok", "keyword"], ["Err", "keyword"], ["true", "keyword"],
  ["false", "keyword"], ["String", "class"], ["Vec", "class"], ["HashMap", "class"],
  ["Option", "class"], ["Result", "class"], ["println", "function"], ["print", "function"],
  ["format", "function"], ["panic", "function"], ["assert", "function"], ["assert_eq", "function"],
  ["push", "method"], ["len", "method"], ["iter", "method"], ["map", "method"],
  ["unwrap", "method"], ["expect", "method"], ["clone", "method"],
]

const RUBY: Entry[] = [
  ["def", "keyword"], ["end", "keyword"], ["class", "keyword"], ["module", "keyword"],
  ["if", "keyword"], ["elsif", "keyword"], ["else", "keyword"], ["unless", "keyword"],
  ["while", "keyword"], ["until", "keyword"], ["for", "keyword"], ["do", "keyword"],
  ["case", "keyword"], ["when", "keyword"], ["return", "keyword"], ["yield", "keyword"],
  ["break", "keyword"], ["next", "keyword"], ["begin", "keyword"], ["rescue", "keyword"],
  ["ensure", "keyword"], ["require", "keyword"], ["require_relative", "keyword"],
  ["attr_accessor", "keyword"], ["nil", "keyword"], ["true", "keyword"], ["false", "keyword"],
  ["self", "keyword"], ["puts", "function"], ["print", "function"], ["p", "function"],
  ["gets", "function"], ["lambda", "function"], ["proc", "function"],
  ["map", "method"], ["each", "method"], ["select", "method"], ["reject", "method"],
  ["reduce", "method"], ["join", "method"], ["split", "method"], ["length", "method"],
  ["to_i", "method"], ["to_s", "method"], ["upcase", "method"], ["downcase", "method"],
]

const PHP: Entry[] = [
  ["function", "keyword"], ["return", "keyword"], ["if", "keyword"], ["else", "keyword"],
  ["elseif", "keyword"], ["foreach", "keyword"], ["for", "keyword"], ["while", "keyword"],
  ["do", "keyword"], ["switch", "keyword"], ["case", "keyword"], ["break", "keyword"],
  ["continue", "keyword"], ["class", "keyword"], ["public", "keyword"], ["private", "keyword"],
  ["protected", "keyword"], ["static", "keyword"], ["new", "keyword"], ["try", "keyword"],
  ["catch", "keyword"], ["finally", "keyword"], ["throw", "keyword"], ["echo", "keyword"],
  ["print", "keyword"], ["array", "keyword"], ["true", "keyword"], ["false", "keyword"],
  ["null", "keyword"], ["$this", "keyword"], ["use", "keyword"], ["namespace", "keyword"],
  ["count", "function"], ["strlen", "function"], ["array_map", "function"],
  ["array_filter", "function"], ["array_merge", "function"], ["in_array", "function"],
  ["implode", "function"], ["explode", "function"], ["json_encode", "function"],
  ["json_decode", "function"], ["var_dump", "function"], ["print_r", "function"],
]

const SQL: Entry[] = [
  ["SELECT", "keyword"], ["FROM", "keyword"], ["WHERE", "keyword"], ["INSERT", "keyword"],
  ["INTO", "keyword"], ["VALUES", "keyword"], ["UPDATE", "keyword"], ["SET", "keyword"],
  ["DELETE", "keyword"], ["CREATE", "keyword"], ["TABLE", "keyword"], ["DROP", "keyword"],
  ["ALTER", "keyword"], ["JOIN", "keyword"], ["LEFT", "keyword"], ["INNER", "keyword"],
  ["ON", "keyword"], ["GROUP", "keyword"], ["BY", "keyword"], ["ORDER", "keyword"],
  ["LIMIT", "keyword"], ["OFFSET", "keyword"], ["HAVING", "keyword"], ["DISTINCT", "keyword"],
  ["AS", "keyword"], ["AND", "keyword"], ["OR", "keyword"], ["NOT", "keyword"],
  ["NULL", "keyword"], ["PRIMARY", "keyword"], ["KEY", "keyword"], ["FOREIGN", "keyword"],
  ["REFERENCES", "keyword"], ["UNIQUE", "keyword"], ["COUNT", "function"],
  ["SUM", "function"], ["AVG", "function"], ["MIN", "function"], ["MAX", "function"],
  ["UPPER", "function"], ["LOWER", "function"], ["LENGTH", "function"], ["ROUND", "function"],
  ["COALESCE", "function"],
]

const BASH: Entry[] = [
  ["if", "keyword"], ["then", "keyword"], ["else", "keyword"], ["elif", "keyword"],
  ["fi", "keyword"], ["for", "keyword"], ["do", "keyword"], ["done", "keyword"],
  ["while", "keyword"], ["case", "keyword"], ["esac", "keyword"], ["function", "keyword"],
  ["echo", "function"], ["printf", "function"], ["read", "function"], ["cd", "function"],
  ["ls", "function"], ["pwd", "function"], ["cat", "function"], ["grep", "function"],
  ["sed", "function"], ["awk", "function"], ["cut", "function"], ["sort", "function"],
  ["uniq", "function"], ["wc", "function"], ["head", "function"], ["tail", "function"],
  ["test", "function"], ["exit", "function"], ["export", "keyword"], ["local", "keyword"],
  ["source", "keyword"], ["return", "keyword"],
]

const LUA: Entry[] = [
  ["local", "keyword"], ["function", "keyword"], ["end", "keyword"], ["if", "keyword"],
  ["then", "keyword"], ["else", "keyword"], ["elseif", "keyword"], ["for", "keyword"],
  ["while", "keyword"], ["do", "keyword"], ["repeat", "keyword"], ["until", "keyword"],
  ["return", "keyword"], ["break", "keyword"], ["nil", "keyword"], ["true", "keyword"],
  ["false", "keyword"], ["and", "keyword"], ["or", "keyword"], ["not", "keyword"],
  ["print", "function"], ["pairs", "function"], ["ipairs", "function"], ["type", "function"],
  ["tostring", "function"], ["tonumber", "function"], ["table", "class"], ["string", "class"],
  ["math", "class"], ["io", "class"], ["os", "class"], ["insert", "method"],
  ["remove", "method"], ["concat", "method"], ["format", "method"], ["sub", "method"],
]

const SWIFT: Entry[] = [
  ["func", "keyword"], ["let", "keyword"], ["var", "keyword"], ["const", "keyword"],
  ["struct", "keyword"], ["class", "keyword"], ["enum", "keyword"], ["protocol", "keyword"],
  ["extension", "keyword"], ["init", "keyword"], ["deinit", "keyword"], ["self", "keyword"],
  ["if", "keyword"], ["else", "keyword"], ["for", "keyword"], ["while", "keyword"],
  ["switch", "keyword"], ["case", "keyword"], ["default", "keyword"], ["return", "keyword"],
  ["guard", "keyword"], ["true", "keyword"], ["false", "keyword"], ["nil", "keyword"],
  ["print", "function"], ["String", "class"], ["Int", "class"], ["Double", "class"],
  ["Array", "class"], ["Dictionary", "class"], ["append", "method"], ["count", "method"],
  ["map", "method"], ["filter", "method"], ["contains", "method"],
]

const COMPLETIONS: Record<string, Entry[]> = {
  python: PYTHON,
  javascript: JAVASCRIPT,
  typescript: JAVASCRIPT,
  java: JAVA,
  c: CPP,
  cpp: CPP,
  go: GO,
  rust: RUST,
  ruby: RUBY,
  php: PHP,
  sql: SQL,
  bash: BASH,
  shell: BASH,
  lua: LUA,
  swift: SWIFT,
}

function canonical(language: string | null | undefined): string {
  return (language ?? "").trim().toLowerCase()
}

/** Identifiers the learner already typed in this snippet (their own names). */
export function localSymbols(code: string, limit = 40): CodeCompletion[] {
  const reserved = new Set(
    COMPLETIONS[canonical("python")]?.map((e) => e[0]) ?? []
  )
  const seen = new Set<string>()
  const out: CodeCompletion[] = []
  for (const m of code.matchAll(/\b[A-Za-z_][A-Za-z0-9_]{2,}\b/g)) {
    const name = m[0]
    if (seen.has(name) || reserved.has(name)) continue
    seen.add(name)
    out.push({ label: name, kind: "local", detail: "in your code" })
    if (out.length >= limit) break
  }
  return out
}

/**
 * Suggestions for a typed prefix: locals first (most specific), then
 * language keywords/builtins. Empty prefix returns the head of the curated
 * list so Ctrl+Space shows something useful. A dotted prefix ("fmt.") is
 * matched on its tail so member completions work — the caller replaces only
 * the segment after the dot.
 */
export function suggestCompletions(
  language: string | null | undefined,
  code: string,
  prefix = "",
  limit = 40
): CodeCompletion[] {
  const entries = COMPLETIONS[canonical(language)] ?? []
  const words: CodeCompletion[] = entries.map(([label, kind, detail]) => ({ label, kind, ...(detail ? { detail } : {}) }))
  const locals = localSymbols(code)
  const needle = (prefix.includes(".") ? prefix.slice(prefix.lastIndexOf(".") + 1) : prefix).toLowerCase()
  const score = (c: CodeCompletion): number => {
    const l = c.label.toLowerCase()
    if (!needle) return c.kind === "local" ? 0 : 2
    if (l === needle) return 0
    if (l.startsWith(needle)) return 1
    if (l.includes(needle)) return 3
    return 99
  }
  return [...locals, ...words]
    .map((c) => ({ c, s: score(c) }))
    .filter((x) => x.s < 99)
    .sort((a, b) => a.s - b.s || a.c.label.localeCompare(b.c.label))
    .slice(0, limit)
    .map((x) => x.c)
}
