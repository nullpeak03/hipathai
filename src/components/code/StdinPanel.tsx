"use client"

import { useMemo, useState, type RefObject } from "react"
import { codeNeedsStdin, extractInputPrompts } from "@/lib/code-runner"

/**
 * Program input state. Kept out of the editor so both the workspace and the
 * compact lesson block share the exact same prompt labelling and "answer then
 * run" behavior.
 */
export function useStdinAnswers(language: string, code: string) {
  const prompts = useMemo(() => extractInputPrompts(language, code), [language, code])
  const needsStdin = codeNeedsStdin(language, code)
  const answerCount = Math.max(prompts.length, needsStdin ? 1 : 0)
  const [values, setValues] = useState<string[]>([])
  // null = follow the code; true/false = learner explicitly opened/closed it.
  const [open, setOpen] = useState<boolean | null>(null)

  const answers = useMemo(() => {
    const next = values.slice(0, answerCount)
    while (next.length < answerCount) next.push("")
    return next
  }, [values, answerCount])

  const setAnswer = (index: number, value: string) => {
    const next = [...answers]
    next[index] = value
    setValues(next)
  }

  const label = (index: number): string => {
    const prompt = prompts[index]
    if (prompt?.prompt) return prompt.prompt
    if (prompt?.variable) return `${prompt.variable}:`
    return answerCount > 1 ? `Question ${index + 1}:` : "Your answer:"
  }

  const reset = () => {
    setValues([])
    setOpen(null)
  }

  return {
    prompts,
    needsStdin,
    answerCount,
    answers,
    setAnswer,
    label,
    stdinText: answers.join("\n"),
    show: open ?? needsStdin,
    setOpen,
    reset,
  }
}

type Props = {
  show: boolean
  answerCount: number
  answers: string[]
  label: (index: number) => string
  setAnswer: (index: number, value: string) => void
  onHide: () => void
  onShow: () => void
  onRun: () => void
  firstAnswerRef: RefObject<HTMLInputElement | null>
  needsStdin: boolean
  compact?: boolean
}

export function StdinPanel({
  show,
  answerCount,
  answers,
  label,
  setAnswer,
  onHide,
  onShow,
  onRun,
  firstAnswerRef,
  needsStdin,
  compact = false,
}: Props) {
  if (!show) {
    return (
      <button
        type="button"
        onClick={onShow}
        className={`${compact ? "mt-2" : "mt-1"} text-xs text-muted-foreground hover:text-foreground underline`}
      >
        + {needsStdin ? "Answer the question your program asks" : "Add answers for a program that asks questions"}
      </button>
    )
  }

  return (
    <div className={`${compact ? "mt-2" : "mt-1"} rounded-lg border border-border bg-muted/40 p-3`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-muted-foreground">
          Your program asks you {answerCount > 1 ? `${answerCount} questions` : "a question"} — answer {answerCount > 1 ? "them" : "it"}, then run
        </span>
        <button type="button" onClick={onHide} className="text-[11px] text-muted-foreground hover:text-foreground">
          Hide
        </button>
      </div>
      <div className="space-y-1.5">
        {answers.map((value, index) => (
          <label key={index} className="flex items-baseline gap-2 text-[13px]">
            <span className="font-mono text-muted-foreground shrink-0 max-w-[55%] truncate" title={label(index)}>
              {label(index)}
            </span>
            <input
              ref={index === 0 ? firstAnswerRef : undefined}
              type="text"
              value={value}
              onChange={(event) => setAnswer(index, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  onRun()
                }
              }}
              aria-label={label(index)}
              placeholder={index === 0 ? "e.g. 20" : "value"}
              className="flex-1 min-w-0 rounded-md border border-border bg-card px-2 py-1 font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Press <span className="font-mono">Enter</span> to run.
      </p>
    </div>
  )
}
