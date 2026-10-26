"use client"
import { useState } from "react"
import type { LessonBlock, LessonContent } from "@/lib/lesson-content-blocks"
import { cn } from "@/lib/utils"
import { ProCodePanel, RunnableCodeBlock } from "@/components/pro/code-panels"
import { Pencil, FlaskConical, TriangleAlert, Key, Lightbulb, Check, X } from "lucide-react"

function CodeBlock({ block, draftKey }: { block: Extract<LessonBlock, { type: "code" }>; draftKey?: string }) {
  return (
    <ProCodePanel code={block.code} language={block.language} title={block.title} draftKey={draftKey} />
  )
}

function ExerciseBlock({ block, language, draftKey }: {
  block: Extract<LessonBlock, { type: "exercise" }>
  language?: string
  draftKey?: string
}) {
  const [open, setOpen] = useState(false)
  const [labOpen, setLabOpen] = useState(false)
  return (
    <div className="mt-4 rounded-xl border border-info-border bg-info-bg p-4">
      <div className="text-xs font-semibold text-info-fg mb-1 flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5" />TRY IT</div>
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
      <div className="mt-3">
        <button
          onClick={() => setLabOpen((o) => !o)}
          className="text-xs font-medium text-info-fg underline"
        >
          <span className="inline-flex items-center gap-1">{labOpen ? "Hide coding lab" : <>Try it yourself — code lab <FlaskConical className="w-3.5 h-3.5" /></>}</span>
        </button>
        {labOpen && (
          <div className="mt-2 rounded-xl overflow-hidden">
            <RunnableCodeBlock code="" language={language ?? "python"} title="SCRATCHPAD" draftKey={draftKey} />
          </div>
        )}
      </div>
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
  const Icon = block.kind === "warning" ? TriangleAlert : block.kind === "key" ? Key : Lightbulb
  return (
    <div className={cn("mt-4 rounded-xl border p-4 text-sm leading-relaxed", styles)}>
      <Icon className="w-3.5 h-3.5 mr-2 shrink-0 inline" />{block.text}
    </div>
  )
}

function CheckBlock({ block, lessonId, sectionIndex }: { block: Extract<LessonBlock, { type: "check" }>; lessonId?: string; sectionIndex: number }) {
  const [picked, setPicked] = useState<number | null>(null)
  const [correct, setCorrect] = useState<boolean | null>(null)
  const [awarded, setAwarded] = useState(false)
  const [checking, setChecking] = useState(false)
  const show = picked !== null
  const handlePick = async (oi: number) => {
    if (picked !== null || checking || !lessonId) return
    setPicked(oi)
    setChecking(true)
    try {
      const res = await fetch("/api/me/quick-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, sectionIndex, answer: oi }),
      })
      if (!res.ok) throw new Error("Could not check answer")
      const result = (await res.json()) as { correct: boolean; awarded: boolean }
      setCorrect(result.correct)
      setAwarded(result.awarded)
    } catch {
      setPicked(null)
      setCorrect(null)
    } finally {
      setChecking(false)
    }
  }
  return (
    <div className="mt-4 rounded-xl border border-border p-4">
      <div className="text-xs font-semibold text-muted-foreground mb-2">QUICK CHECK{awarded ? " • +1 XP" : ""}</div>
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
                : oi === picked && correct
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
        <p className={cn("mt-2 text-xs", correct ? "text-ok-fg" : "text-danger-fg")}>
          <span className="inline-flex items-center gap-1">{checking ? "Checking…" : correct ? <><Check className="w-3 h-3" /> Correct</> : <><X className="w-3 h-3" /> Try again</>} {block.explanation ? `— ${block.explanation}` : ""}</span>
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
export function LessonBody({ doc, lessonId }: { doc: LessonContent; lessonId?: string }) {
  const firstCode = doc.sections.find(
    (s): s is Extract<LessonBlock, { type: "code" }> => s.type === "code"
  )
  const docLanguage = firstCode?.language ?? "python"
  const keyFor = (i: number, suffix = "") => (lessonId ? `${lessonId}:${i}${suffix}` : undefined)
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
            return <p key={i} className="text-sm leading-relaxed mt-3 max-w-prose">{b.text}</p>
          case "bullets":
            return (
              <ul key={i} className="list-disc pl-5 space-y-1.5 mt-3 text-sm leading-relaxed max-w-prose">
                {b.items.map((item, j) => <li key={j}>{item}</li>)}
              </ul>
            )
          case "code":
            return <CodeBlock key={i} block={b} draftKey={keyFor(i)} />
          case "callout":
            return <CalloutBlock key={i} block={b} />
          case "exercise":
            return <ExerciseBlock key={i} block={b} language={docLanguage} draftKey={keyFor(i, ":lab")} />
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
            return <CheckBlock key={i} block={b} lessonId={lessonId} sectionIndex={i} />
          case "resources":
            return <ResourcesBlock key={i} block={b} />
          case "image":
            return <ImageBlock key={i} block={b} />
        }
      })}
    </div>
  )
}

function ImageBlock({ block }: { block: Extract<LessonBlock, { type: "image" }> }) {
  return (
    <div className="mt-4 rounded-xl border border-border p-4 bg-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={block.url}
        alt={block.alt ?? "Lesson image"}
        className="max-w-full h-auto rounded-lg border border-border"
        loading="lazy"
      />
      {block.caption && (
        <p className="mt-2 text-xs text-center text-muted-foreground">{block.caption}</p>
      )}
    </div>
  )
}
