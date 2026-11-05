"use client"

import { useState } from "react"
import { AlertTriangle, ChevronDown, ChevronRight, Copy, Terminal, Trash2 } from "lucide-react"
import type { CodeOutput, RunHistoryEntry } from "./use-code-run"

function ageLabel(at: number): string {
  const secs = Math.max(0, Math.round((Date.now() - at) / 1000))
  if (secs < 60) return `${secs}s ago`
  return `${Math.round(secs / 60)}m ago`
}

type Props = {
  output: CodeOutput
  outputTab: "stdout" | "stderr"
  setOutputTab: (tab: "stdout" | "stderr") => void
  history: RunHistoryEntry[]
  errorLine?: number | null
  onJumpToLine?: (line: number) => void
  onClear: () => void
  compact?: boolean
}

export function OutputPanel({
  output,
  outputTab,
  setOutputTab,
  history,
  errorLine,
  onJumpToLine,
  onClear,
  compact = false,
}: Props) {
  const [openRuns, setOpenRuns] = useState<number[]>([])

  if (output.state === "idle") {
    return (
      <div className={`${compact ? "py-5" : "py-8"} text-center text-xs text-muted-foreground`}>
        Run your code to see output here.
      </div>
    )
  }

  if (output.state === "running") {
    return (
      <div role="status" aria-live="polite" className="px-3 py-4 text-xs text-muted-foreground">
        Running… <span className="inline-block animate-pulse">●</span>
      </div>
    )
  }

  if (output.state === "error") {
    return (
      <div className="p-3">
        <div className="text-xs text-danger-fg bg-danger-bg border border-danger-border rounded-lg p-3">
          {output.message}
        </div>
      </div>
    )
  }

  const hasErrors = output.stderr.trim().length > 0

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-[11px] text-muted-foreground bg-muted border-b border-border">
        <div className="flex items-center gap-1" role="tablist" aria-label="Program output">
          <button
            type="button"
            role="tab"
            aria-selected={outputTab === "stdout"}
            onClick={() => setOutputTab("stdout")}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${outputTab === "stdout" ? "bg-card text-foreground" : "hover:text-foreground"}`}
          >
            <Terminal className="w-3 h-3" /> Output
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={outputTab === "stderr"}
            onClick={() => setOutputTab("stderr")}
            disabled={!hasErrors}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded disabled:opacity-40 ${outputTab === "stderr" ? "bg-card text-foreground" : "hover:text-foreground"}`}
          >
            <AlertTriangle className="w-3 h-3" /> Errors
            {hasErrors ? <span className="text-danger-fg">({output.stderr.trim().split("\n").length})</span> : null}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className={output.exitCode === 0 ? "text-ok-fg" : "text-danger-fg"}>
            {output.exitCode === 0 ? "exited cleanly" : `exit ${output.exitCode}`}
          </span>
          <span>{output.runMs}ms</span>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(outputTab === "stdout" ? output.stdout : output.stderr)}
            className="hover:text-foreground"
            aria-label="Copy output"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button type="button" onClick={onClear} className="hover:text-foreground" aria-label="Clear output">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {errorLine != null && outputTab === "stderr" && onJumpToLine ? (
        <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] bg-danger-bg/40 text-danger-fg border-b border-danger-border">
          Failed on line {errorLine}
          <button type="button" onClick={() => onJumpToLine(errorLine)} className="underline underline-offset-2 hover:text-danger-fg/80">
            Jump to it
          </button>
        </div>
      ) : null}

      <pre className={`bg-zinc-900 text-zinc-100 p-3 overflow-auto font-mono whitespace-pre-wrap ${compact ? "max-h-48 text-[12px]" : "flex-1 min-h-0 text-[13px]"}`}>
        {(outputTab === "stdout" ? output.stdout : output.stderr) || (outputTab === "stdout" ? "(no output)" : "(no errors)")}
      </pre>

      {history.length > 1 ? (
        <div className="border-t border-border p-2 text-[11px] text-muted-foreground max-h-24 overflow-auto">
          {history.map((entry) => (
            <div key={entry.at} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setOpenRuns((previous) =>
                    previous.includes(entry.at) ? previous.filter((value) => value !== entry.at) : [...previous, entry.at]
                  )
                }
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                {openRuns.includes(entry.at) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <span className={entry.exitCode === 0 ? "text-ok-fg" : "text-danger-fg"}>
                  {entry.exitCode === 0 ? "clean" : `exit ${entry.exitCode}`}
                </span>
                <span>{entry.runMs}ms</span>
                <span>{ageLabel(entry.at)}</span>
              </button>
              {openRuns.includes(entry.at) ? (
                <pre className="flex-1 bg-zinc-900 text-zinc-300 p-2 overflow-auto max-h-24 text-[11px] whitespace-pre-wrap rounded font-mono">
                  {(entry.stdout || entry.stderr || "(no output)").slice(0, 2000)}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
