"use client"
import { useState } from "react"
import { splitQuizCodeSpans } from "@/lib/quiz"

function QuizCodePanel({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async (e: React.MouseEvent) => {
    // Panels live inside <label> option rows — don't toggle the radio.
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable — no-op
    }
  }
  return (
    <span className="block my-2">
      <span className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold text-muted-foreground">{language}</span>
        <button
          onClick={(e) => void copy(e)}
          className="text-[11px] text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-0.5"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </span>
      <pre className="bg-zinc-900 text-zinc-100 p-3 rounded-lg overflow-x-auto text-[13px] whitespace-pre"><code>{code}</code></pre>
    </span>
  )
}

/** `inline` spans render as monospace pills; plain text passes through. */
function InlineCode({ text }: { text: string }) {
  const parts = text.split(/`([^`]+)`/g)
  if (parts.length === 1) return <>{text}</>
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <code key={i} className="font-mono text-[0.9em] bg-muted px-1.5 py-0.5 rounded-md border border-border whitespace-pre-wrap break-words">{p}</code>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  )
}

/**
 * Quiz question/option/explanation text with code handling: fenced spans
 * become copyable panels, `inline` spans become pills — never flat
 * paragraph mush.
 */
export function QuizRichText({ text, className }: { text: string; className?: string }) {
  const spans = splitQuizCodeSpans(text)
  return (
    <span className={className}>
      {spans.map((s, i) =>
        s.kind === "code" ? (
          <QuizCodePanel key={i} language={s.language} code={s.code} />
        ) : (
          <InlineCode key={i} text={s.text} />
        )
      )}
    </span>
  )
}
