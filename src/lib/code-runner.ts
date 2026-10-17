// Remote code execution via Wandbox (https://wandbox.org) — free public
// compile API, no key, pinned compiler versions. (Piston's public API went
// whitelist-only in 2026, so it can't serve anonymous runs.)
// Called server-side only (route adds auth + Pro gate + rate limits);
// the client never touches the runner.

const WANDBOX_URL = process.env.WANDBOX_API_URL || "https://wandbox.org/api/compile.json"

export const MAX_RUN_CODE_CHARS = 4000
export const MAX_OUTPUT_CHARS = 4000
export const RUN_TIMEOUT_MS = 20000

/** Lesson block language -> pinned Wandbox compiler. Unsupported -> null (no Run button). */
const LANGUAGE_MAP: Record<string, string> = {
  python: "cpython-3.12.7",
  py: "cpython-3.12.7",
  javascript: "nodejs-20.17.0",
  js: "nodejs-20.17.0",
  typescript: "typescript-5.6.2",
  ts: "typescript-5.6.2",
  java: "openjdk-jdk-21+35",
  c: "gcc-13.2.0-c",
  cpp: "gcc-13.2.0",
  "c++": "gcc-13.2.0",
  go: "go-1.23.2",
  rust: "rust-1.82.0",
  ruby: "ruby-4.0.2",
  php: "php-8.3.12",
  sql: "sqlite-3.46.1",
  sqlite: "sqlite-3.46.1",
  bash: "bash",
  shell: "bash",
  swift: "swift-6.0.1",
  lua: "lua-5.4.7",
}

export function runnerLanguage(language: string | null | undefined): string | null {
  if (!language) return null
  return LANGUAGE_MAP[language.trim().toLowerCase()] ?? null
}

export type RunResult =
  | { ok: true; stdout: string; stderr: string; exitCode: number; runMs: number }
  | { ok: false; error: string }

/**
 * Does this program read from stdin? Keyed by pinned Wandbox compiler (the
 * canonical language id used everywhere in this module), never the display
 * label, so "py"/"python"/"Python" all resolve the same way. A lesson that
 * teaches `input()` otherwise fails with a raw `EOFError` traceback, which is
 * the single most confusing first-run experience (see "Values your program
 * reads" in the editor UI).
 */
const STDIN_PATTERNS: Record<string, RegExp[]> = {
  "cpython-3.12.7": [/\binput\s*\(/, /\braw_input\s*\(/, /sys\.stdin/, /\.readline\s*\(/, /\bgetpass\b/],
  "nodejs-20.17.0": [/\bprompt\s*\(/, /readline/, /process\.stdin/],
  "typescript-5.6.2": [/\bprompt\s*\(/, /readline/, /process\.stdin/],
  "openjdk-jdk-21+35": [/new\s+Scanner\b/, /\.next(?:Line|Int|Double|Long)\s*\(/, /System\.in\b/, /\bBufferedReader\b/],
  "gcc-13.2.0-c": [/\bstd::cin\b/, /\bcin\s*>>/, /\bscanf\s*\(/, /\bfscanf\s*\(/, /\bgetchar\s*\(/, /\bgets\s*\(/, /\bfgets\s*\(/],
  "gcc-13.2.0": [/\bstd::cin\b/, /\bcin\s*>>/, /\bscanf\s*\(/, /\bfscanf\s*\(/, /\bgetchar\s*\(/, /\bgets\s*\(/, /\bfgets\s*\(/],
  "go-1.23.2": [/fmt\.Scan/, /bufio\.NewScanner/, /\.Scanln?\s*\(/],
  "rust-1.82.0": [/stdin\s*\(\s*\)/, /read_line\s*\(/],
  "ruby-4.0.2": [/\bgets\b/, /\bSTDIN\b/, /\breadline\b/],
  "php-8.3.12": [/\bfgets\s*\(/, /\breadline\s*\(/, /\bSTDIN\b/],
  "swift-6.0.1": [/\breadLine\s*\(/],
  "lua-5.4.7": [/\bio\.read\b/, /\bio\.lines\b/],
  bash: [/\bread\s+(?:-[a-zA-Z]+\s+)*/, /\bread\s+-p\b/],
}

/**
 * Blank out comments before detecting input reads — a lesson that explains
 * `input()` in a comment must not be told it needs program input (which would
 * wrongly block its run with a misleading message). Over-stripping is safe
 * here: this text is only matched against, never executed.
 */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/#[^\n]*/g, " ")
}

export function codeNeedsStdin(language: string | null | undefined, code: string): boolean {
  const compiler = runnerLanguage(language)
  if (!compiler) return false
  const patterns = STDIN_PATTERNS[compiler]
  if (!patterns) return false
  const scannable = stripComments(code)
  return patterns.some((p) => p.test(scannable))
}

/** How many times the program reads a line — drives the "one line per read" hint. */
export function countStdinReads(language: string | null | undefined, code: string): number {
  const compiler = runnerLanguage(language)
  if (!compiler) return 0
  const primary = STDIN_PATTERNS[compiler]?.[0]
  if (!primary) return 0
  // Global copy so the shared RegExp objects stay lastIndex-clean for
  // codeNeedsStdin's .test() calls.
  return (stripComments(code).match(new RegExp(primary.source, `${primary.flags}g`)) ?? []).length
}

/** Programs that catch EOFError/stdin errors can legitimately run with no input. */
function toleratesMissingStdin(code: string): boolean {
  return /EOFError|end of file|stdin\.empty|empty input|no\s+input/i.test(code)
}

/**
 * Learner-facing message when the program reads input but none was supplied.
 * Cheaper and far clearer than letting the runner return a traceback.
 */
export function preflightStdinError(language: string | null | undefined, code: string, stdin: string): string | null {
  if (stdin.trim().length > 0) return null
  if (toleratesMissingStdin(code)) return null
  if (!codeNeedsStdin(language, code)) return null
  const reads = countStdinReads(language, code)
  const howMany = reads > 1 ? `${reads} values (one per line, in read order)` : "at least one value"
  return `This code asks for input, but none was provided. Open "Values your program reads" below the editor and add ${howMany}.`
}

/** First source line named by a runtime traceback (1-based), or null. */
export function firstErrorLine(stderr: string): number | null {
  if (!stderr) return null
  const all = (re: RegExp) => [...stderr.matchAll(re)].map((m) => parseInt(m[1] as string, 10)).filter((n) => n > 0)
  // Python/C/Ruby list frames innermost-last; Java/Go/Rust/JS put the throw site
  // first. Take the first pattern that matches, with its idiomatic direction.
  const rules: [RegExp, "first" | "last"][] = [
    [/File "[^"]*", line (\d+)/g, "last"],
    [/[\w.-]+\.(?:js|jsx|ts|tsx):(\d+)/g, "first"],
    [/[\w./\\-]+\.(?:java|kt):(\d+)/g, "first"],
    [/\.(?:go|rs):(\d+)/g, "first"],
    [/prog\w*\.(?:c|cc|cpp|cxx):(\d+)/g, "last"],
    [/:(\d+):in /g, "last"],
  ]
  for (const [re, dir] of rules) {
    const found = all(re)
    if (found.length > 0) return dir === "first" ? (found[0] as number) : (found[found.length - 1] as number)
  }
  return null
}

function truncateOutput(s: string): string {
  if (s.length <= MAX_OUTPUT_CHARS) return s
  return s.slice(0, MAX_OUTPUT_CHARS) + `\n… (truncated, ${s.length - MAX_OUTPUT_CHARS} more chars)`
}

export async function runCode(
  language: string,
  code: string,
  stdin = "",
  fetchFn: typeof fetch = fetch,
  timeoutMs: number = RUN_TIMEOUT_MS
): Promise<RunResult> {
  const compiler = runnerLanguage(language)
  if (!compiler) return { ok: false, error: `Running ${language || "this language"} is not supported yet.` }
  const trimmed = code.trim()
  if (trimmed.length === 0) return { ok: false, error: "Nothing to run — write some code first." }
  if (trimmed.length > MAX_RUN_CODE_CHARS) {
    return { ok: false, error: `Code is too long (${trimmed.length} > ${MAX_RUN_CODE_CHARS} chars).` }
  }
  // Programs that read input without any values fail with a raw traceback
  // (Python: EOFError) — name the fix instead.
  const stdinProblem = preflightStdinError(language, trimmed, stdin)
  if (stdinProblem) return { ok: false, error: stdinProblem }
  const started = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchFn(WANDBOX_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compiler, code: trimmed, stdin: stdin.slice(0, MAX_OUTPUT_CHARS) }),
      signal: controller.signal,
    })
    if (!res.ok) {
      return { ok: false, error: `Runner unavailable (HTTP ${res.status}). Try again in a minute.` }
    }
    const data = (await res.json()) as {
      status?: string
      program_output?: string
      program_error?: string
      compiler_error?: string
      message?: string
    }
    if (data.message && data.status === undefined) {
      return { ok: false, error: String(data.message).slice(0, 200) }
    }
    const stderr = [data.compiler_error, data.program_error].filter(Boolean).join("\n")
    return {
      ok: true,
      stdout: truncateOutput(data.program_output ?? ""),
      stderr: truncateOutput(stderr),
      exitCode: data.status === "0" ? 0 : 1,
      runMs: Date.now() - started,
    }
  } catch (e) {
    const aborted = e instanceof Error && (e.name === "AbortError" || /abort/i.test(e.message))
    return {
      ok: false,
      error: aborted
        ? "Runner is taking too long — the free queue may be busy, or the code may loop forever. Try again, shorten long loops, or copy it to run locally."
        : "Runner unreachable. Check your connection or copy the code to run locally.",
    }
  } finally {
    clearTimeout(timeout)
  }
}
