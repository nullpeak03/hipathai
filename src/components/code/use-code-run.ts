"use client"

import { useCallback, useRef, useState } from "react"
import { firstErrorLine, type RunResult } from "@/lib/code-runner"

export type CodeOutput =
  | { state: "idle" }
  | { state: "running" }
  | { state: "error"; message: string }
  | { state: "done"; stdout: string; stderr: string; exitCode: number; runMs: number; at: number }

export type RunHistoryEntry = {
  stdout: string
  stderr: string
  exitCode: number
  runMs: number
  at: number
}

const RUN_HISTORY_LIMIT = 3

/**
 * Shared run state for the standalone workspace and lesson blocks. UI decides
 * where to render it; this hook only talks to /api/code/run and keeps history.
 */
export function useCodeRunner({
  onUpgrade,
  onNeedsStdin,
}: {
  onUpgrade: () => void
  onNeedsStdin: () => void
}) {
  const [output, setOutput] = useState<CodeOutput>({ state: "idle" })
  const [outputTab, setOutputTab] = useState<"stdout" | "stderr">("stdout")
  const [history, setHistory] = useState<RunHistoryEntry[]>([])
  const runningRef = useRef(false)
  const upgradeRef = useRef(onUpgrade)
  const needsStdinRef = useRef(onNeedsStdin)
  upgradeRef.current = onUpgrade
  needsStdinRef.current = onNeedsStdin

  const run = useCallback(async (language: string, code: string, stdin = ""): Promise<RunResult | null> => {
    if (runningRef.current) return null
    runningRef.current = true
    setOutput({ state: "running" })
    try {
      const res = await fetch("/api/code/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code, stdin }),
      })
      const data = (await res.json().catch(() => ({}))) as Partial<
        RunResult & { error?: string; upgradeRequired?: boolean }
      >
      if (res.status === 402 || data.upgradeRequired) {
        setOutput({ state: "idle" })
        upgradeRef.current()
        return null
      }
      if (!res.ok || !("stdout" in (data as object))) {
        const message = (data as { error?: string }).error || "Run failed. Try again."
        if (/asks (you a question|\d+ question)/i.test(message)) needsStdinRef.current()
        setOutput({ state: "error", message })
        return null
      }
      const ok = data as Extract<RunResult, { ok: true }>
      const at = Date.now()
      setOutput({
        state: "done",
        stdout: ok.stdout,
        stderr: ok.stderr,
        exitCode: ok.exitCode,
        runMs: ok.runMs,
        at,
      })
      setOutputTab(ok.stderr.trim().length > 0 && ok.stdout.length === 0 ? "stderr" : "stdout")
      setHistory((previous) =>
        [
          { stdout: ok.stdout, stderr: ok.stderr, exitCode: ok.exitCode, runMs: ok.runMs, at },
          ...previous,
        ].slice(0, RUN_HISTORY_LIMIT)
      )
      return ok
    } catch {
      setOutput({ state: "error", message: "Could not reach the runner. Check your connection." })
      return null
    } finally {
      runningRef.current = false
    }
  }, [])

  const reset = useCallback(() => {
    setOutput({ state: "idle" })
  }, [])

  const errorLine = output.state === "done" ? firstErrorLine(output.stderr) : null
  const errorMessage =
    output.state === "done" && output.stderr.trim()
      ? output.stderr.trim().split("\n").slice(-1)[0]
      : undefined

  return {
    output,
    outputTab,
    setOutputTab,
    history,
    run,
    reset,
    errorLine,
    errorMessage,
  }
}
