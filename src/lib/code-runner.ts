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
