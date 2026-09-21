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
    } catch {
      // clipboard unavailable — no-op
    }
  }
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-muted-foreground">
          {block.title ?? "EXAMPLE"} <span className="font-normal">· {block.language}</span>
        </div>
        <button
          onClick={() => void copy()}
          className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-xl overflow-x-auto text-sm"><code>{block.code}</code></pre>
    </div>
  )
}

function ExerciseBlock({ block }: { block: Extract<LessonBlock, { type: "exercise" }> }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-4 rounded-xl border border-info-border bg-info-bg p-4">
      <div className="text-xs font-semibold text-info-fg mb-1">✏️ TRY IT</div>
      <p className="text-sm leading-relaxed">{block.prompt}</p>
      {block.solution && (
        <>
          <button
            onClick={() => setOpen((o) => !o)}
            className="mt-2 text-xs font-medium text-info-fg underline"
          >
            {open ? "Hide solution" : "Reveal solution"}
          </button>
          {open && <p className="mt-2 text-sm leading-relaxed">{block.solution}</p>}
        </>
      )}
    </div>
  )
}

function CalloutBlock({ block }: { block: Extract<LessonBlock, { type: "callout" }> }) {
  const styles =
    block.kind === "warning"
      ? "border-warn-border bg-warn-bg text-warn-fg"
      : block.kind === "key"
        ? "border-ok-border bg-ok-bg text-ok-fg"
        : "border-info-border bg-info-bg text-info-fg"
  const icon = block.kind === "warning" ? "⚠️" : block.kind === "key" ? "🔑" : "💡"
  return (
    <div className={cn("mt-4 rounded-xl border p-4 text-sm leading-relaxed", styles)}>
      <span className="mr-2">{icon}</span>{block.text}
    </div>
  )
}

/** Structured lesson body — one component per block type. */
export function LessonBody({ doc }: { doc: LessonContent }) {
  return (
    <div>
      {doc.sections.map((b, i) => {
        switch (b.type) {
          case "objectives":
            return (
              <div key={i} className="rounded-xl border border-info-border bg-info-bg p-4">
                <div className="text-xs font-semibold text-info-fg mb-2">WHAT YOU WILL LEARN</div>
                <ul className="list-disc pl-5 space-y-1 text-sm leading-relaxed">
                  {b.items.map((item, j) => <li key={j}>{item}</li>)}
                </ul>
              </div>
            )
          case "heading":
            return <h3 key={i} className="font-bold text-lg mt-6 first:mt-0">{b.text}</h3>
          case "paragraph":
            return <p key={i} className="text-sm leading-relaxed mt-3">{b.text}</p>
          case "bullets":
            return (
              <ul key={i} className="list-disc pl-5 space-y-1.5 mt-3 text-sm leading-relaxed">
                {b.items.map((item, j) => <li key={j}>{item}</li>)}
              </ul>
            )
          case "code":
            return <CodeBlock key={i} block={b} />
          case "callout":
            return <CalloutBlock key={i} block={b} />
          case "exercise":
            return <ExerciseBlock key={i} block={b} />
          case "recap":
            return (
              <div key={i} className="mt-6 rounded-xl border border-ok-border bg-ok-bg p-4">
                <div className="text-xs font-semibold text-ok-fg mb-2">KEY TAKEAWAYS</div>
                <ul className="list-disc pl-5 space-y-1 text-sm leading-relaxed">
                  {b.items.map((item, j) => <li key={j}>{item}</li>)}
                </ul>
              </div>
            )
        }
      })}
    </div>
  )
}
