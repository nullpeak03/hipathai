"use client"
import { useState } from "react"
import type { LessonBlock, LessonContent } from "@/lib/lesson-content-blocks"
import { cn } from "@/lib/utils"

function CodeBlock({ block }: { block: Extract<LessonBlock, { type: "code" }> }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(block.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] font-semibold text-muted-foreground">
          {block.title ?? "CODE"} <span className="font-normal">· {block.language}</span>
        </div>
        <button onClick={() => void copy()} className="text-[11px] text-muted-foreground hover:text-foreground border border-border rounded px-1.5 py-0.5">
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre className="bg-zinc-900 text-zinc-100 p-3 rounded-lg overflow-x-auto text-xs"><code>{block.code}</code></pre>
    </div>
  )
}

function CheckBlock({ block }: { block: Extract<LessonBlock, { type: "check" }> }) {
  const [picked, setPicked] = useState<number | null>(null)
  return (
    <div className="mt-3 rounded-lg border border-border p-3 bg-card">
      <p className="text-xs font-medium">{block.prompt}</p>
      <div className="grid gap-1.5 mt-2">
        {block.options.map((opt, oi) => (
          <button
            key={oi}
            onClick={() => picked === null && setPicked(oi)}
            className={cn(
              "text-left p-2 rounded-lg border text-xs",
              picked === null ? "bg-card hover:bg-muted" : oi === block.correct ? "bg-ok-bg border-ok-border" : picked === oi ? "bg-danger-bg border-danger-border" : "bg-card opacity-60"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
      {picked !== null && (
        <p className={cn("mt-1.5 text-[11px]", picked === block.correct ? "text-ok-fg" : "text-danger-fg")}>
          {picked === block.correct ? "✓ Correct" : "✗ Try again"} {block.explanation ? `— ${block.explanation}` : ""}
        </p>
      )}
    </div>
  )
}

/** Tutor message body — structured blocks, compact for chat bubbles, copy-only code, no XP. */
export function TutorMessageBody({ doc }: { doc: LessonContent }) {
  return (
    <div className="space-y-2.5 text-sm leading-relaxed">
      {doc.sections.map((b, i) => {
        switch (b.type) {
          case "objectives":
            return (
              <div key={i} className="rounded-lg border border-info-border bg-info-bg p-3">
                <div className="text-[11px] font-semibold text-info-fg mb-1">WHAT YOU WILL LEARN</div>
                <ul className="list-disc pl-4 space-y-0.5 text-xs">
                  {b.items.map((item, j) => <li key={j}>{item}</li>)}
                </ul>
              </div>
            )
          case "heading":
            return <h4 key={i} className="font-semibold text-sm mt-2 first:mt-0">{b.text}</h4>
          case "paragraph":
            return <p key={i} className="text-xs leading-relaxed">{b.text}</p>
          case "bullets":
            return <ul key={i} className="list-disc pl-4 space-y-1 text-xs">{b.items.map((item, j) => <li key={j}>{item}</li>)}</ul>
          case "code":
            return <CodeBlock key={i} block={b} />
          case "callout":
            return (
              <div key={i} className={cn("rounded-lg border p-2.5 text-xs", b.kind === "warning" ? "border-warn-border bg-warn-bg text-warn-fg" : b.kind === "key" ? "border-ok-border bg-ok-bg text-ok-fg" : "border-info-border bg-info-bg text-info-fg")}>
                <span className="mr-1">{b.kind === "warning" ? "⚠️" : b.kind === "key" ? "🔑" : "💡"}</span>{b.text}
              </div>
            )
          case "exercise":
            return (
              <div key={i} className="rounded-lg border border-info-border bg-info-bg p-3">
                <div className="text-[11px] font-semibold text-info-fg">TRY IT</div>
                <p className="text-xs mt-1">{b.prompt}</p>
                {b.solution && <p className="text-xs mt-1 opacity-80">Solution: {b.solution}</p>}
              </div>
            )
          case "recap":
            return (
              <div key={i} className="rounded-lg border border-ok-border bg-ok-bg p-3">
                <div className="text-[11px] font-semibold text-ok-fg">KEY TAKEAWAYS</div>
                <ul className="list-disc pl-4 space-y-0.5 text-xs mt-1">{b.items.map((item, j) => <li key={j}>{item}</li>)}</ul>
              </div>
            )
          case "check":
            return <CheckBlock key={i} block={b} />
          case "resources":
            return (
              <div key={i} className="rounded-lg border border-border p-3">
                <div className="text-[11px] font-semibold text-muted-foreground">GO DEEPER</div>
                <ul className="space-y-1 mt-1">{b.items.map((r, j) => <li key={j} className="text-xs"><a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{r.label}</a></li>)}</ul>
              </div>
            )
        }
      })}
    </div>
  )
}
