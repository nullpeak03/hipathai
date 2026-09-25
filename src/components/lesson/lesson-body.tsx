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
          {open && <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{block.solution}</p>}
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

function CheckBlock({ block }: { block: Extract<LessonBlock, { type: "check" }> }) {
  const [picked, setPicked] = useState<number | null>(null)
  const [rewarded, setRewarded] = useState(false)
  const show = picked !== null
  const handlePick = (oi: number) => {
    if (picked !== null) return
    setPicked(oi)
    if (oi === block.correct && !rewarded) {
      setRewarded(true)
      try {
        const gRaw = localStorage.getItem("hipath_gamification")
        const g = gRaw ? JSON.parse(gRaw) : { xp: 0, level: 1, streak: 0, bestStreak: 0, passRate: 0, studyMinutes: 0, lessonsDone: 0 }
        const newXp = (g.xp || 0) + 1
        const updated = { ...g, xp: newXp }
        localStorage.setItem("hipath_gamification", JSON.stringify(updated))
        fetch("/api/me/gamification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gam: updated }) }).catch(()=>{})
      } catch {}
    }
  }
  return (
    <div className="mt-4 rounded-xl border border-border p-4">
      <div className="text-xs font-semibold text-muted-foreground mb-2">QUICK CHECK • +1 XP</div>
      <p className="text-sm font-medium">{block.prompt}</p>
      <div className="grid gap-2 mt-3">
        {block.options.map((opt, oi) => (
          <button
            key={oi}
            onClick={() => handlePick(oi)}
            className={cn(
              "text-left p-3 rounded-lg border text-sm",
              picked === null
                ? "bg-card hover:bg-muted"
                : oi === block.correct
                  ? "bg-ok-bg border-ok-border"
                  : picked === oi
                    ? "bg-danger-bg border-danger-border"
                    : "bg-card opacity-60"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
      {show && (
        <p className={cn("mt-2 text-xs", picked === block.correct ? "text-ok-fg" : "text-danger-fg")}>
          {picked === block.correct ? "✓ Correct" : "✗ Try again"} {block.explanation ? `— ${block.explanation}` : ""}
        </p>
      )}
    </div>
  )
}
function ResourcesBlock({ block }: { block: Extract<LessonBlock, { type: "resources" }> }) {
  return (
    <div className="mt-4 rounded-xl border border-border p-4">
      <div className="text-xs font-semibold text-muted-foreground mb-2">GO DEEPER</div>
      <ul className="space-y-1.5">
        {block.items.map((r, j) => (
          <li key={j} className="text-sm">
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
              {r.label}
            </a>
          </li>
        ))}
      </ul>
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
          case "check":
            return <CheckBlock key={i} block={b} />
          case "resources":
            return <ResourcesBlock key={i} block={b} />
        }
      })}
    </div>
  )
}
