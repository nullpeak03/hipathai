"use client"
import { useState } from "react"
import type { LessonBlock, LessonContent } from "@/lib/lesson-content-blocks"
import { cn } from "@/lib/utils"
import { TriangleAlert, Key, Lightbulb, Check, X } from "lucide-react"

/** Dark, read-only code card from the Tutor design (copy only). */
function CodeBlock({ block }: { block: Extract<LessonBlock, { type: "code" }> }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(block.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // clipboard unavailable
    }
  }
  return (
    <div className="my-2 overflow-hidden rounded-[10px] bg-zinc-900 text-zinc-100">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-1 text-[11px] text-zinc-400">
        <span>{block.title || block.language}</span>
        <button onClick={() => void copy()} className="rounded-md px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-white/10">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed">
        <code>{block.code}</code>
      </pre>
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
          <span className="inline-flex items-center gap-1">{picked === block.correct ? <><Check className="w-3 h-3" /> Correct</> : <><X className="w-3 h-3" /> Try again</>} {block.explanation ? `— ${block.explanation}` : ""}</span>
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
                <span className="mr-1 inline-flex align-[-2px]">{b.kind === "warning" ? <TriangleAlert className="w-3.5 h-3.5" /> : b.kind === "key" ? <Key className="w-3.5 h-3.5" /> : <Lightbulb className="w-3.5 h-3.5" />}</span>{b.text}
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
          case "image":
            return (
              <div key={i} className="mt-3 rounded-lg border border-border p-3 bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
                  src={b.url}
                  alt={b.alt ?? "Image"}
                  className="max-w-full h-auto rounded-lg border border-border"
                  loading="lazy"
                />
                {b.caption && <p className="mt-2 text-xs text-center text-muted-foreground">{b.caption}</p>}
              </div>
            )
        }
      })}
    </div>
  )
}
