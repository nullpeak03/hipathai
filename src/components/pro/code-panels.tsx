"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Zap, Check, Play, Copy, Trash2, ChevronDown, ChevronRight, Terminal, AlertTriangle } from "lucide-react"
import { EditorState, Compartment, StateEffect, StateField, type Extension } from "@codemirror/state"
import {
  EditorView,
  Decoration,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  keymap,
  type DecorationSet,
  type KeyBinding,
} from "@codemirror/view"
import { oneDark } from "@codemirror/theme-one-dark"
import { defaultHighlightStyle, syntaxHighlighting, indentUnit, indentOnInput, bracketMatching } from "@codemirror/language"
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete"
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search"
import { lintKeymap, lintGutter, linter, type Diagnostic } from "@codemirror/lint"
import { python } from "@codemirror/lang-python"
import { javascript } from "@codemirror/lang-javascript"
import { java } from "@codemirror/lang-java"
import { cpp } from "@codemirror/lang-cpp"
import { go } from "@codemirror/lang-go"
import { rust } from "@codemirror/lang-rust"
import { php } from "@codemirror/lang-php"
import { sql } from "@codemirror/lang-sql"
import type { LanguageSupport } from "@codemirror/language"
import { runnerLanguage, codeNeedsStdin, extractInputPrompts, firstErrorLine, type RunResult } from "@/lib/code-runner"
import { suggestCompletions } from "@/lib/code-completions"
import { loadCodeDraft, saveCodeDraft, clearCodeDraft } from "@/lib/code-drafts"

function editorLanguage(language: string): LanguageSupport | null {
  switch (runnerLanguage(language)) {
    case "cpython-3.12.7": return python()
    case "nodejs-20.17.0": return javascript()
    case "typescript-5.6.2": return javascript({ typescript: true })
    case "openjdk-jdk-21+35": return java()
    case "gcc-13.2.0": return cpp()
    case "gcc-13.2.0-c": return cpp()
    case "go-1.23.2": return go()
    case "rust-1.82.0": return rust()
    case "php-8.3.12": return php()
    case "sqlite-3.46.1": return sql()
    default: return null
  }
}

/* ---------------------------------- editor --------------------------------- */

/** Highlight the line a runtime traceback points at, like a real IDE gutter. */
const setErrorLine = StateEffect.define<number | null>()
const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    let next = deco.map(tr.changes)
    for (const effect of tr.effects) {
      if (!effect.is(setErrorLine)) continue
      next = Decoration.none
      const lineNo = effect.value
      if (lineNo == null) continue
      const line = tr.state.doc.line(Math.min(lineNo, tr.state.doc.lines))
      next = Decoration.set([Decoration.line({ class: "cm-error-line" }).range(line.from)])
    }
    return next
  },
  provide: (f) => EditorView.decorations.from(f),
})

/** Last run's runtime errors as gutter diagnostics + hover tooltips. */
const setRunDiagnostics = StateEffect.define<Diagnostic[]>()
const runDiagnostics = StateField.define<Diagnostic[]>({
  create: () => [],
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setRunDiagnostics)) return effect.value
    return value
  },
})
const runLinter = linter((view) => view.state.field(runDiagnostics, false) ?? [], { delay: 0 })

/** Curated completions (keywords/builtins + the learner's own identifiers). */
function completionSource(language: string) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[\w.]+/)
    if (!context.explicit && (!word || word.from === word.to)) return null
    const raw = word?.text ?? ""
    // "fmt." → replace only the tail, so the receiver stays intact.
    const dot = raw.lastIndexOf(".")
    const prefix = dot >= 0 ? raw.slice(dot + 1) : raw
    const from = word ? (dot >= 0 ? word.from + dot + 1 : word.from) : context.pos
    const options = suggestCompletions(language, context.state.doc.toString(), prefix).map((c) => ({
      label: c.label,
      type: c.kind,
      detail: c.detail,
      boost: c.kind === "local" ? 40 : c.kind === "keyword" ? 20 : 10,
    }))
    if (options.length === 0) return null
    return { from, options, validFor: /^[\w.]*$/ }
  }
}

const editorBaseTheme = EditorView.theme({
  "&": { maxHeight: "26rem" },
  ".cm-scroller": { overflow: "auto", fontFamily: "var(--font-geist-mono), ui-monospace, monospace" },
  ".cm-content": { padding: "10px 0", caretColor: "#f8fafc" },
  ".cm-gutters": { border: "none", backgroundColor: "transparent", color: "#64748b" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#94a3b8" },
  ".cm-activeLine": { backgroundColor: "#ffffff08" },
  ".cm-error-line": { backgroundColor: "#7f1d1d66", boxShadow: "inset 2px 0 0 #f87171" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "#33415580 !important" },
})

const autocompleteTheme = EditorView.theme({
  ".cm-tooltip-autocomplete": {
    backgroundColor: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "10px",
    overflow: "hidden",
    boxShadow: "0 12px 30px #00000066",
  },
  ".cm-tooltip-autocomplete > ul": { fontFamily: "var(--font-geist-mono), ui-monospace, monospace", fontSize: "12px" },
  ".cm-tooltip-autocomplete > ul > li": { padding: "3px 10px" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "#1d4ed8", color: "#fff" },
  ".cm-completionDetail": { marginLeft: "10px", fontStyle: "normal", color: "#94a3b8" },
  ".cm-completionLabel": { fontWeight: "500" },
})

const fontSizeTheme = (px: number): Extension =>
  EditorView.theme({ ".cm-content, .cm-gutters": { fontSize: `${px}px` } })

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
      {copied ? <span className="inline-flex items-center gap-1">Copied <Check className="w-3 h-3" /></span> : "Copy"}
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
        <h3 className="font-semibold flex items-center gap-1.5">Code Runner is a Pro feature <Zap className="w-4 h-4 text-primary" /></h3>
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
  | { state: "done"; stdout: string; stderr: string; exitCode: number; runMs: number; at: number }

type RunHistoryEntry = { stdout: string; stderr: string; exitCode: number; runMs: number; at: number }

const FONT_SIZES = [12, 13, 14, 16, 18]
const RUN_HISTORY_LIMIT = 3

function ageLabel(at: number): string {
  const secs = Math.max(0, Math.round((Date.now() - at) / 1000))
  if (secs < 60) return `${secs}s ago`
  return `${Math.round(secs / 60)}m ago`
}

/**
 * Editable + runnable editor (Pro). Drafts persist per draftKey.
 *
 * Phase 1 gives it real editor behaviour (line numbers, keymaps, history,
 * auto-indent, bracket closing, search, autocomplete, Ctrl/Cmd+Enter to run);
 * phase 2 surfaces program input exactly when the code needs it; phase 3
 * separates stdout from stderr and links tracebacks back to the source line.
 */
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
  const firstAnswerRef = useRef<HTMLInputElement>(null)
  const runRef = useRef<() => void>(() => {})

  const [code, setCode] = useState(() =>
    draftKey ? (loadCodeDraft(draftKey) ?? initialCode) : initialCode
  )
  const [output, setOutput] = useState<Output>({ state: "idle" })
  const [outputTab, setOutputTab] = useState<"stdout" | "stderr">("stdout")
  const [stdinValues, setStdinValues] = useState<string[]>([])
  // null = follow the code (auto-open when it reads input); true/false = the
  // learner explicitly opened/closed the box.
  const [stdinOpen, setStdinOpen] = useState<boolean | null>(null)
  const [upgraded, setUpgraded] = useState(false)
  const [wrap, setWrap] = useState(true)
  const [fontSize, setFontSize] = useState(13)
  const [historyLog, setHistoryLog] = useState<RunHistoryEntry[]>([])
  const [openRuns, setOpenRuns] = useState<number[]>([])

  const wrapCompartment = useRef(new Compartment()).current
  const sizeCompartment = useRef(new Compartment()).current

  // Phase 2: the program asks questions — one labelled answer box per read.
  const inputPrompts = useMemo(() => extractInputPrompts(language, code), [language, code])
  const needsStdin = codeNeedsStdin(language, code)
  const answerCount = Math.max(inputPrompts.length, needsStdin ? 1 : 0)
  const showStdin = stdinOpen ?? needsStdin
  // Values are keyed by read order; resize when the code gains/loses reads.
  const answers = useMemo(() => {
    const next = stdinValues.slice(0, answerCount)
    while (next.length < answerCount) next.push("")
    return next
  }, [stdinValues, answerCount])
  const stdinText = answers.join("\n")
  const setAnswer = (i: number, v: string) => {
    const next = [...answers]
    next[i] = v
    setStdinValues(next)
  }
  const answerLabel = (i: number): string => {
    const p = inputPrompts[i]
    if (p?.prompt) return p.prompt
    if (p?.variable) return `${p.variable}:`
    return answerCount > 1 ? `Question ${i + 1}:` : "Your answer:"
  }

  // Create the editor once per mount.
  useEffect(() => {
    if (!containerRef.current || viewRef.current) return
    const lang = editorLanguage(language)
    const state = EditorState.create({
      doc: code,
      extensions: [
        oneDark,
        editorBaseTheme,
        autocompleteTheme,
        // Real-editor essentials: gutter, active line, selections, cursors.
        lintGutter(),
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        rectangularSelection(),
        crosshairCursor(),
        EditorState.allowMultipleSelections.of(true),
        highlightActiveLine(),
        highlightSelectionMatches(),
        EditorView.contentAttributes.of({ "aria-label": "Code editor", autocapitalize: "off", autocomplete: "off", spellcheck: "false" }),
        // Editing behaviour: indent on input, 4-wide tabs, auto-close brackets.
        indentUnit.of("  "),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        // Diagnostics + highlighted failure line from the last run.
        runLinter,
        errorLineField,
        // Curated completions (keywords, builtins, your own identifiers).
        autocompletion({ override: [completionSource(language)] }),
        // Keymaps (order matters: search/lint/completion before default).
        keymap.of([
          { key: "Mod-Enter", preventDefault: true, run: () => (runRef.current(), true) },
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...lintKeymap,
          indentWithTab,
        ] as KeyBinding[]),
        EditorState.tabSize.of(4),
        wrapCompartment.of(EditorView.lineWrapping),
        sizeCompartment.of(fontSizeTheme(fontSize)),
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

  // Toggle line wrapping without recreating the editor.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: wrapCompartment.reconfigure(wrap ? EditorView.lineWrapping : []),
    })
  }, [wrap, wrapCompartment])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: sizeCompartment.reconfigure(fontSizeTheme(fontSize)) })
  }, [fontSize, sizeCompartment])

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

  /** Point the editor at a failing line and show why. */
  const jumpToLine = useCallback((line: number) => {
    const view = viewRef.current
    if (!view) return
    const target = view.state.doc.line(Math.min(Math.max(1, line), view.state.doc.lines))
    view.dispatch({
      selection: { anchor: target.from },
      effects: [
        EditorView.scrollIntoView(target.from, { y: "center" }),
        setErrorLine.of(target.number),
      ],
    })
    view.focus()
  }, [])

  const run = useCallback(async () => {
    if (output.state === "running") return
    setOutput({ state: "running" })
    try {
      const res = await fetch("/api/code/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code, stdin: stdinText }),
      })
      const data = (await res.json().catch(() => ({}))) as Partial<RunResult & { error?: string; upgradeRequired?: boolean }>
      if (res.status === 402 || data.upgradeRequired) {
        setOutput({ state: "idle" })
        setUpgraded(true)
        return
      }
      if (!res.ok || !("stdout" in (data as object))) {
        // Phase 2: "this code needs input" arrives as an error — reveal the box
        // and put the caret in it, so the fix is obvious.
        const message = (data as { error?: string }).error || "Run failed. Try again."
        if (/asks (you a question|\d+ question)/i.test(message)) {
          setStdinOpen(true)
          firstAnswerRef.current?.focus()
        }
        setOutput({ state: "error", message })
        return
      }
      const ok = data as Extract<RunResult, { ok: true }>
      const at = Date.now()
      setOutput({ state: "done", stdout: ok.stdout, stderr: ok.stderr, exitCode: ok.exitCode, runMs: ok.runMs, at })
      setOutputTab(ok.stderr.trim().length > 0 && ok.stdout.length === 0 ? "stderr" : "stdout")
      setHistoryLog((prev) =>
        [{ stdout: ok.stdout, stderr: ok.stderr, exitCode: ok.exitCode, runMs: ok.runMs, at }, ...prev].slice(0, RUN_HISTORY_LIMIT)
      )
      // Phase 3: mark the failing line in the gutter + highlight it.
      const line = firstErrorLine(ok.stderr)
      const view = viewRef.current
      if (view) {
        const diagnostics: Diagnostic[] = []
        if (line != null) {
          const docLine = view.state.doc.line(Math.min(line, view.state.doc.lines))
          diagnostics.push({
            from: docLine.from,
            to: Math.max(docLine.to, docLine.from + 1),
            severity: "error",
            message: ok.stderr.trim().split("\n").slice(-1)[0] || "Runtime error",
          })
        }
        view.dispatch({ effects: [setRunDiagnostics.of(diagnostics), setErrorLine.of(line)] })
        if (line != null) {
          const target = view.state.doc.line(Math.min(line, view.state.doc.lines))
          view.dispatch({ effects: EditorView.scrollIntoView(target.from, { y: "center" }) })
        }
      }
    } catch {
      setOutput({ state: "error", message: "Could not reach the runner. Check your connection." })
    }
  }, [code, language, output.state, stdinText])

  // Latest run() for the Ctrl/Cmd+Enter keymap (avoids re-creating the editor).
  useEffect(() => {
    runRef.current = () => void run()
  }, [run])

  const reset = () => {
    dirtyRef.current = false
    setCode(initialCode)
    setOutput({ state: "idle" })
    setStdinValues([])
    setStdinOpen(null)
    if (draftKey) clearCodeDraft(draftKey)
    const view = viewRef.current
    if (view) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: initialCode },
        effects: [setErrorLine.of(null), setRunDiagnostics.of([])],
      })
    }
  }

  const fontIndex = FONT_SIZES.indexOf(fontSize)
  const stepFont = (delta: number) => {
    const next = FONT_SIZES[Math.min(FONT_SIZES.length - 1, Math.max(0, fontIndex + delta))]
    if (next !== undefined) setFontSize(next)
  }

  const done = output.state === "done" ? output : null
  const hasErrors = !!done && done.stderr.trim().length > 0
  const errorLine = done ? firstErrorLine(done.stderr) : null

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
            title="Run (Ctrl/Cmd + Enter)"
            className="text-xs font-medium text-primary-foreground bg-primary hover:bg-primary-hover rounded-md px-3 py-1 disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Play className="w-3 h-3" />
            {output.state === "running" ? "Running…" : "Run"}
          </button>
        </>
      }
    >
      <div className="relative">
        <div
          ref={containerRef}
          className="rounded-xl overflow-hidden border border-border text-sm [&_.cm-editor]:bg-zinc-900"
        />
        {/* Compact editor toolbar — keeps the chrome out of the way like a real IDE pane. */}
        <div className="flex items-center gap-1 absolute top-1.5 right-2 z-10 text-[11px]">
          <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-black/40 text-slate-400 font-mono">⌘/Ctrl+↵</span>
          <button
            onClick={() => stepFont(-1)}
            disabled={fontIndex <= 0}
            aria-label="Decrease font size"
            className="px-1.5 py-0.5 rounded bg-black/40 text-slate-300 hover:bg-black/60 disabled:opacity-40"
          >
            A−
          </button>
          <button
            onClick={() => stepFont(1)}
            disabled={fontIndex >= FONT_SIZES.length - 1}
            aria-label="Increase font size"
            className="px-1.5 py-0.5 rounded bg-black/40 text-slate-300 hover:bg-black/60 disabled:opacity-40"
          >
            A+
          </button>
          <button
            onClick={() => setWrap((w) => !w)}
            aria-pressed={wrap}
            title="Toggle line wrap"
            className={`px-1.5 py-0.5 rounded ${wrap ? "bg-black/60 text-white" : "bg-black/40 text-slate-400 hover:bg-black/60"}`}
          >
            Wrap
          </button>
        </div>
      </div>

      {showStdin && (
        <div className="mt-2 rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-muted-foreground">
              Your program asks you {answerCount > 1 ? `${answerCount} questions` : "a question"} — answer {answerCount > 1 ? "them" : "it"}, then run
            </span>
            <button onClick={() => setStdinOpen(false)} className="text-[11px] text-muted-foreground hover:text-foreground">
              Hide
            </button>
          </div>
          <div className="space-y-1.5">
            {answers.map((value, i) => (
              <label key={i} className="flex items-baseline gap-2 text-[13px]">
                <span className="font-mono text-zinc-300 shrink-0 max-w-[55%] truncate" title={answerLabel(i)}>
                  {answerLabel(i)}
                </span>
                <input
                  ref={i === 0 ? firstAnswerRef : undefined}
                  type="text"
                  value={value}
                  onChange={(e) => setAnswer(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void run()
                    }
                  }}
                  aria-label={answerLabel(i)}
                  placeholder={i === 0 ? "e.g. 20" : "value"}
                  className="flex-1 min-w-0 rounded-md border border-border bg-zinc-900 px-2 py-1 font-mono text-zinc-100 focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </label>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Press <span className="font-mono">Enter</span> to run.
          </p>
        </div>
      )}
      {!showStdin && (
        <button
          onClick={() => setStdinOpen(true)}
          className="mt-2 text-xs text-muted-foreground hover:text-foreground underline"
        >
          + {needsStdin ? "Answer the question your program asks" : "Add answers for a program that asks questions"}
        </button>
      )}

      {output.state === "running" && (
        <div className="mt-2 text-xs text-muted-foreground">Running… <span className="inline-block animate-pulse">●</span></div>
      )}
      {output.state === "error" && (
        <div className="mt-2 text-xs text-danger-fg bg-danger-bg border border-danger-border rounded-lg p-3">
          {output.message}
        </div>
      )}
      {done && (
        <div className="mt-2 rounded-lg border border-border overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-[11px] text-muted-foreground bg-muted">
            <div className="flex items-center gap-1" role="tablist" aria-label="Program output">
              <button
                role="tab"
                aria-selected={outputTab === "stdout"}
                onClick={() => setOutputTab("stdout")}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${outputTab === "stdout" ? "bg-card text-foreground" : "hover:text-foreground"}`}
              >
                <Terminal className="w-3 h-3" /> Output
              </button>
              <button
                role="tab"
                aria-selected={outputTab === "stderr"}
                onClick={() => setOutputTab("stderr")}
                disabled={!hasErrors}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded disabled:opacity-40 ${outputTab === "stderr" ? "bg-card text-foreground" : "hover:text-foreground"}`}
              >
                <AlertTriangle className="w-3 h-3" /> Errors
                {hasErrors ? <span className="text-danger-fg">({done.stderr.trim().split("\n").length})</span> : null}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className={done.exitCode === 0 ? "text-emerald-400" : "text-danger-fg"}>
                {done.exitCode === 0 ? "exited cleanly" : `exit ${done.exitCode}`}
              </span>
              <span>{done.runMs}ms</span>
              <button onClick={() => void navigator.clipboard?.writeText(outputTab === "stdout" ? done.stdout : done.stderr)} className="hover:text-foreground" aria-label="Copy output">
                <Copy className="w-3 h-3" />
              </button>
              <button onClick={() => setOutput({ state: "idle" })} className="hover:text-foreground" aria-label="Clear output">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
          {errorLine != null && outputTab === "stderr" && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] bg-danger-bg/40 text-danger-fg border-b border-danger-border">
              Failed on line {errorLine}
              <button onClick={() => jumpToLine(errorLine)} className="underline underline-offset-2 hover:text-danger-fg/80">
                Jump to it
              </button>
            </div>
          )}
          <pre className="bg-zinc-900 text-zinc-100 p-3 overflow-auto max-h-72 text-[13px] whitespace-pre-wrap font-mono">
            {(outputTab === "stdout" ? done.stdout : done.stderr) || (outputTab === "stdout" ? "(no output)" : "(no errors)")}
          </pre>
        </div>
      )}

      {historyLog.length > 1 && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          {historyLog.map((entry) => (
            <div key={entry.at} className="flex items-center gap-2">
              <button
                onClick={() => setOpenRuns((prev) => (prev.includes(entry.at) ? prev.filter((x) => x !== entry.at) : [...prev, entry.at]))}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                {openRuns.includes(entry.at) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <span className={entry.exitCode === 0 ? "text-emerald-400" : "text-danger-fg"}>
                  {entry.exitCode === 0 ? "clean" : `exit ${entry.exitCode}`}
                </span>
                <span>{entry.runMs}ms</span>
                <span>{ageLabel(entry.at)}</span>
              </button>
              {openRuns.includes(entry.at) && (
                <pre className="flex-1 bg-zinc-900 text-zinc-300 p-2 overflow-auto max-h-32 text-[11px] whitespace-pre-wrap rounded font-mono">
                  {(entry.stdout || entry.stderr || "(no output)").slice(0, 2000)}
                </pre>
              )}
            </div>
          ))}
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
