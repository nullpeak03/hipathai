"use client"
import { useEffect, useRef, useState } from "react"
import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { oneDark } from "@codemirror/theme-one-dark"
import { python } from "@codemirror/lang-python"
import { javascript } from "@codemirror/lang-javascript"
import { java } from "@codemirror/lang-java"
import { cpp } from "@codemirror/lang-cpp"
import { go } from "@codemirror/lang-go"
import { rust } from "@codemirror/lang-rust"
import { php } from "@codemirror/lang-php"
import { sql } from "@codemirror/lang-sql"
import type { LanguageSupport } from "@codemirror/language"
import { runnerLanguage, type RunResult } from "@/lib/code-runner"
import { loadCodeDraft, saveCodeDraft, clearCodeDraft } from "@/lib/code-drafts"

function editorLanguage(language: string): LanguageSupport | null {
  switch (runnerLanguage(language)) {
    case "python": return python()
    case "javascript": return javascript()
    case "typescript": return javascript({ typescript: true })
    case "java": return java()
    case "cpp": return cpp()
    case "go": return go()
    case "rust": return rust()
    case "php": return php()
    case "sqlite3": return sql()
    default: return null
  }
}

function PanelShell({ title, language, action, children }: {
  title?: string
  language: string
  action: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-muted-foreground">
          {title ?? "EXAMPLE"} <span className="font-normal">· {language}</span>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      {children}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        void (async () => {
          try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          } catch { /* clipboard unavailable */ }
        })()
      }}
      className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  )
}

/** Read-only panel (free tier + fallback). Matches lesson styling. */
export function StaticCodePanel({ code, language, title }: { code: string; language: string; title?: string }) {
  return (
    <PanelShell title={title} language={language} action={<CopyButton text={code} />}>
      <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-xl overflow-x-auto text-sm"><code>{code}</code></pre>
    </PanelShell>
  )
}

export function ProUpgradeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label="Pro feature">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border border-border shadow-xl max-w-sm w-full p-6">
        <h3 className="font-semibold">Code Runner is a Pro feature ⚡</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Upgrade to Pro to edit and run code right inside lessons, quizzes, and
          the tutor — Python, JavaScript, Java, C++, Go, Rust and more, with
          your drafts saved per lesson.
        </p>
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg text-sm font-medium h-10 px-6 py-2 bg-primary text-primary-foreground hover:bg-primary-hover"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

type Output =
  | { state: "idle" }
  | { state: "running" }
  | { state: "error"; message: string }
  | { state: "done"; stdout: string; stderr: string; exitCode: number; runMs: number }

/** Editable + runnable editor (Pro). Drafts persist per draftKey. */
export function RunnableCodeBlock({ code: initialCode, language, title, draftKey }: {
  code: string
  language: string
  title?: string
  draftKey?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const dirtyRef = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [code, setCode] = useState(() =>
    draftKey ? (loadCodeDraft(draftKey) ?? initialCode) : initialCode
  )
  const [output, setOutput] = useState<Output>({ state: "idle" })
  const [showStdin, setShowStdin] = useState(false)
  const [stdin, setStdin] = useState("")
  const [upgraded, setUpgraded] = useState(false)

  // Create the editor once per mount.
  useEffect(() => {
    if (!containerRef.current || viewRef.current) return
    const lang = editorLanguage(language)
    const state = EditorState.create({
      doc: code,
      extensions: [
        oneDark,
        EditorView.lineWrapping,
        ...(lang ? [lang] : []),
        EditorView.updateListener.of((v) => {
          if (!v.docChanged) return
          const next = v.state.doc.toString()
          dirtyRef.current = true
          setCode(next)
          if (draftKey) {
            if (saveTimer.current) clearTimeout(saveTimer.current)
            saveTimer.current = setTimeout(() => saveCodeDraft(draftKey, next), 500)
          }
        }),
      ],
    })
    viewRef.current = new EditorView({ state, parent: containerRef.current })
    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // External source changed (regenerated lesson) and user hasn't edited: resync.
  useEffect(() => {
    if (dirtyRef.current) return
    if (code !== initialCode) setCode(initialCode)
    const view = viewRef.current
    if (view && view.state.doc.toString() !== initialCode) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: initialCode } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode, draftKey])

  const run = async () => {
    if (output.state === "running") return
    setOutput({ state: "running" })
    try {
      const res = await fetch("/api/code/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code, stdin }),
      })
      const data = (await res.json().catch(() => ({}))) as Partial<RunResult & { error?: string; upgradeRequired?: boolean }>
      if (res.status === 402 || data.upgradeRequired) {
        setOutput({ state: "idle" })
        setUpgraded(true)
        return
      }
      if (!res.ok || !("stdout" in (data as object))) {
        setOutput({ state: "error", message: (data as { error?: string }).error || "Run failed. Try again." })
        return
      }
      const ok = data as Extract<RunResult, { ok: true }>
      setOutput({ state: "done", stdout: ok.stdout, stderr: ok.stderr, exitCode: ok.exitCode, runMs: ok.runMs })
    } catch {
      setOutput({ state: "error", message: "Could not reach the runner. Check your connection." })
    }
  }

  const reset = () => {
    dirtyRef.current = false
    setCode(initialCode)
    setOutput({ state: "idle" })
    if (draftKey) clearCodeDraft(draftKey)
    viewRef.current?.dispatch({
      changes: { from: 0, to: viewRef.current.state.doc.length, insert: initialCode },
    })
  }

  return (
    <PanelShell
      title={title}
      language={language}
      action={
        <>
          <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1">
            Reset
          </button>
          <CopyButton text={code} />
          <button
            onClick={() => void run()}
            disabled={output.state === "running"}
            className="text-xs font-medium text-primary-foreground bg-primary hover:bg-primary-hover rounded-md px-3 py-1 disabled:opacity-50"
          >
            {output.state === "running" ? "Running…" : "▶ Run"}
          </button>
        </>
      }
    >
      <div ref={containerRef} className="rounded-xl overflow-hidden border border-border text-sm [&_.cm-editor]:bg-zinc-900" />
      <button onClick={() => setShowStdin((s) => !s)} className="mt-2 text-xs text-muted-foreground hover:text-foreground underline">
        {showStdin ? "Hide program input" : "+ Program input (stdin)"}
      </button>
      {showStdin && (
        <textarea
          value={stdin}
          onChange={(e) => setStdin(e.target.value)}
          placeholder={"input() lines go here, one per line"}
          rows={2}
          aria-label="Program input"
          className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-mono focus:outline-none"
        />
      )}
      {output.state === "running" && (
        <div className="mt-2 text-xs text-muted-foreground">Running… <span className="inline-block animate-pulse">●</span></div>
      )}
      {output.state === "error" && (
        <div className="mt-2 text-xs text-danger-fg bg-danger-bg border border-danger-border rounded-lg p-3">{output.message}</div>
      )}
      {output.state === "done" && (
        <div className="mt-2 rounded-lg border border-border overflow-hidden">
          <div className="flex justify-between px-3 py-1.5 text-[11px] text-muted-foreground bg-muted">
            <span>Output</span>
            <span>exit {output.exitCode} · {output.runMs}ms</span>
          </div>
          {output.stdout ? (
            <pre className="bg-zinc-900 text-zinc-100 p-3 overflow-x-auto text-[13px] whitespace-pre-wrap">{output.stdout}</pre>
          ) : null}
          {output.stderr ? (
            <pre className="bg-zinc-900 text-red-300 p-3 overflow-x-auto text-[13px] whitespace-pre-wrap">{output.stderr}</pre>
          ) : null}
          {!output.stdout && !output.stderr ? (
            <div className="bg-zinc-900 text-zinc-400 p-3 text-[13px]">(no output)</div>
          ) : null}
        </div>
      )}
      <ProUpgradeDialog open={upgraded} onClose={() => setUpgraded(false)} />
    </PanelShell>
  )
}

/**
 * Editor shell: runnable languages get the editor UI; others get the static
 * panel. Actual execution is gated server-side (owner + is_pro allowlist),
 * so this component never decides access — 402s surface the dialog.
 */
export function ProCodePanel({ code, language, title, draftKey }: {
  code: string
  language: string
  title?: string
  draftKey?: string
}) {
  const runnable = runnerLanguage(language) !== null
  if (runnable) {
    return <RunnableCodeBlock code={code} language={language} title={title} draftKey={draftKey} />
  }
  return (
    <PanelShell
      title={title}
      language={language}
      action={<CopyButton text={code} />}
    >
      <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-xl overflow-x-auto text-sm"><code>{code}</code></pre>
    </PanelShell>
  )
}
