"use client"

import { useEffect, useRef, useState } from "react"
import { Play } from "lucide-react"
import { clearCodeDraft, loadCodeDraft, saveCodeDraft } from "@/lib/code-drafts"
import { loadEditorSettings, saveEditorSettings, DEFAULT_EDITOR_SETTINGS, type EditorSettings } from "@/lib/code/editor-settings"
import { CodeMirrorEditor, type CodeMirrorEditorHandle } from "./CodeMirrorEditor"
import { StdinPanel, useStdinAnswers } from "./StdinPanel"
import { OutputPanel } from "./OutputPanel"
import { CopyButton, PanelShell, ProUpgradeDialog } from "./panel-shell"
import { useCodeRunner } from "./use-code-run"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

// The compact editor used inside lessons and the standalone page in Phase 1.
// It intentionally has no project tree, cloud sync, or AI panel.
export function LessonCodeWorkspace({
  code: initialCode,
  language,
  title,
  draftKey,
  testCases,
  readOnly = false,
}: {
  code: string
  language: string
  title?: string
  draftKey?: string
  testCases?: { input: string; expected: string }[]
  readOnly?: boolean
}) {
  const editorRef = useRef<CodeMirrorEditorHandle>(null)
  const firstAnswerRef = useRef<HTMLInputElement>(null)
  const dirtyRef = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const codeRef = useRef(initialCode)
  const draftKeyRef = useRef(draftKey)
  draftKeyRef.current = draftKey

  const [code, setCode] = useState(initialCode)
  codeRef.current = code
  const [settings, setSettings] = useState<EditorSettings>(DEFAULT_EDITOR_SETTINGS)
  const [upgraded, setUpgraded] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [lastRunCode, setLastRunCode] = useState<string | null>(null)

  useEffect(() => {
    setSettings(loadEditorSettings())
  }, [])

  const stdin = useStdinAnswers(language, code)
  const runner = useCodeRunner({
    onUpgrade: () => setUpgraded(true),
    onNeedsStdin: () => {
      stdin.setOpen(true)
      setTimeout(() => firstAnswerRef.current?.focus(), 0)
    },
  })

  // Drafts load after mount so SSR markup matches the first client render.
  useEffect(() => {
    if (!draftKey) return
    const stored = loadCodeDraft(draftKey)
    if (stored != null) {
      dirtyRef.current = true
      setCode(stored)
    }
  }, [draftKey])

  // A regenerated lesson replaces the code only when the learner hasn't edited.
  useEffect(() => {
    if (dirtyRef.current) return
    setCode((current) => (current === initialCode ? current : initialCode))
  }, [initialCode, draftKey])

  useEffect(() => {
    return () => {
      if (!saveTimer.current) return
      clearTimeout(saveTimer.current)
      if (draftKeyRef.current) saveCodeDraft(draftKeyRef.current, codeRef.current)
    }
  }, [])

  const updateCode = (next: string) => {
    dirtyRef.current = true
    setCode(next)
    if (!draftKey) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      saveCodeDraft(draftKey, next)
    }, 500)
  }

  const updateSettings = (patch: Partial<EditorSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch }
      saveEditorSettings(next)
      return next
    })
  }

  const run = () => {
    setLastRunCode(code)
    void runner.run(language, code, stdin.stdinText)
  }

  const reset = () => {
    dirtyRef.current = false
    setCode(initialCode)
    setLastRunCode(null)
    runner.reset()
    stdin.reset()
    if (draftKey) clearCodeDraft(draftKey)
  }

  const errorLine = lastRunCode === code ? runner.errorLine : null

  return (
    <PanelShell
      title={title}
      language={language}
      action={
        <>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1"
          >
            Reset
          </button>
          <CopyButton text={code} />
          <button
            type="button"
            onClick={run}
            disabled={runner.output.state === "running"}
            title="Run (Ctrl/Cmd + Enter)"
            aria-label="Run code"
            className="text-xs font-medium text-primary-foreground bg-primary hover:bg-primary-hover rounded-md px-3 py-1 disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Play className="w-3 h-3" />
            {runner.output.state === "running" ? "Running…" : "Run"}
          </button>
        </>
      }
    >
      <div className="relative">
        <CodeMirrorEditor
          ref={editorRef}
          fileId={draftKey ?? `${title ?? "lesson"}:${language}`}
          value={code}
          language={language}
          settings={settings}
          onChange={updateCode}
          onRun={run}
          readOnly={readOnly}
          errorLine={errorLine}
          errorMessage={runner.errorMessage}
          ariaLabel={`${language} code editor`}
          className="rounded-xl overflow-hidden border border-border text-sm"
        />
        <div className="flex items-center gap-1 absolute top-1.5 right-2 z-10 text-[11px]">
          <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-black/40 text-slate-400 font-mono">⌘/Ctrl+↵</span>
          <button
            type="button"
            onClick={() => updateSettings({ fontSize: Math.max(12, settings.fontSize - 1) })}
            disabled={settings.fontSize <= 12}
            aria-label="Decrease font size"
            className="px-1.5 py-0.5 rounded bg-black/40 text-slate-300 hover:bg-black/60 disabled:opacity-40"
          >
            A−
          </button>
          <button
            type="button"
            onClick={() => updateSettings({ fontSize: Math.min(20, settings.fontSize + 1) })}
            disabled={settings.fontSize >= 20}
            aria-label="Increase font size"
            className="px-1.5 py-0.5 rounded bg-black/40 text-slate-300 hover:bg-black/60 disabled:opacity-40"
          >
            A+
          </button>
          <button
            type="button"
            onClick={() => updateSettings({ wrap: !settings.wrap })}
            aria-pressed={settings.wrap}
            title="Toggle line wrap"
            className={`px-1.5 py-0.5 rounded ${settings.wrap ? "bg-black/60 text-white" : "bg-black/40 text-slate-400 hover:bg-black/60"}`}
          >
            Wrap
          </button>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Running code sends its source and input to Wandbox for execution. Don&apos;t include passwords, API keys, or other secrets.{" "}
        <a href="/privacy" className="underline hover:text-foreground">Privacy details</a>
      </p>

      <StdinPanel
        show={stdin.show}
        answerCount={stdin.answerCount}
        answers={stdin.answers}
        label={stdin.label}
        setAnswer={stdin.setAnswer}
        onHide={() => stdin.setOpen(false)}
        onShow={() => stdin.setOpen(true)}
        onRun={run}
        firstAnswerRef={firstAnswerRef}
        needsStdin={stdin.needsStdin}
        compact
      />

      {testCases && testCases.length > 0 ? (
        <div className="mt-2 rounded-lg border border-border p-3">
          <div className="text-[11px] font-semibold text-muted-foreground mb-2">TEST CASES</div>
          <div className="space-y-2">
            {testCases.map((testCase, index) => (
              <div key={index} className="text-xs font-mono">
                <div>Input: {testCase.input || "(none)"}</div>
                <div>Expected: {testCase.expected}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-2 rounded-lg border border-border overflow-hidden">
        <OutputPanel
          output={runner.output}
          outputTab={runner.outputTab}
          setOutputTab={runner.setOutputTab}
          history={runner.history}
          errorLine={errorLine}
          onJumpToLine={(line) => editorRef.current?.jumpToLine(line)}
          onClear={runner.reset}
          compact
        />
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset this code?"
        description="Your edits will be replaced with the original example. This cannot be undone."
        confirmLabel="Reset code"
        danger
        onConfirm={() => {
          setConfirmReset(false)
          reset()
        }}
        onClose={() => setConfirmReset(false)}
      />
      <ProUpgradeDialog open={upgraded} onClose={() => setUpgraded(false)} />
    </PanelShell>
  )
}
