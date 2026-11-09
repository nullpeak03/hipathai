"use client"

import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import { Check, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QuizRichText } from "@/components/quiz/quiz-rich-text"
import type { AssessmentResult, PublicQuizQuestion } from "@/lib/assessment"
import { PHASE_EXAM_PASS_THRESHOLD } from "@/lib/v2-mastery"
import { cn } from "@/lib/utils"

export type PhaseExamState = {
  assessmentId: string
  quiz: PublicQuizQuestion[]
  answers: Record<number, number>
  submitted: boolean
  score: number
  passed: boolean
  results?: AssessmentResult["results"]
}

type PhaseExamDialogProps = {
  open: boolean
  phaseTitle: string
  phaseIndex: number
  exam: PhaseExamState | null
  submitting: boolean
  onSelect: (questionIndex: number, optionIndex: number) => void
  onSubmit: () => void
  onClose: () => void
  onNewAttempt: () => void
}

export function PhaseExamDialog({
  open,
  phaseTitle,
  phaseIndex,
  exam,
  submitting,
  onSelect,
  onSubmit,
  onClose,
  onNewAttempt,
}: PhaseExamDialogProps) {
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    requestAnimationFrame(() => closeRef.current?.focus())

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== "Tab") return
      const panel = panelRef.current
      if (!panel) return
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKeyDown)
      previousFocus?.focus()
    }
  }, [open, onClose])

  if (!open || !exam || typeof document === "undefined") return null

  const answered = Object.keys(exam.answers).length
  const allAnswered = answered >= exam.quiz.length

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <motion.section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="phase-exam-title"
        initial={{ y: 24, opacity: 0, scale: 0.99 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:max-h-[85vh] sm:max-w-2xl sm:rounded-2xl"
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30 sm:hidden" aria-hidden />

        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Phase {phaseIndex + 1} checkpoint
            </p>
            <h2 id="phase-exam-title" className="mt-0.5 text-lg font-semibold leading-snug">
              {phaseTitle}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {exam.quiz.length} questions · pass at {PHASE_EXAM_PASS_THRESHOLD}%
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close checkpoint"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <motion.div
            className="space-y-4"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
          >
            {exam.quiz.map((question, questionIndex) => {
              const selected = exam.answers[questionIndex]
              const result = exam.results?.[questionIndex]
              return (
                <motion.fieldset
                  key={questionIndex}
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
                  }}
                  className="rounded-xl border border-border bg-card p-4"
                  disabled={submitting}
                >
                  <legend className="float-left w-full text-sm font-medium leading-snug">
                    <span className="mr-1 text-muted-foreground">{questionIndex + 1}.</span>
                    <QuizRichText text={question.q} draftKey={`exam:${exam.assessmentId}:q${questionIndex}`} />
                  </legend>
                  <div className="clear-both mt-3 grid gap-2">
                    {question.options.map((option, optionIndex) => {
                      const isSelected = selected === optionIndex
                      return (
                        <label
                          key={optionIndex}
                          className={cn(
                            "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card hover:bg-muted/50",
                            exam.submitted && "cursor-default"
                          )}
                        >
                          <input
                            type="radio"
                            name={`phase-exam-${exam.assessmentId}-q-${questionIndex}`}
                            checked={isSelected}
                            disabled={exam.submitted || submitting}
                            onChange={() => onSelect(questionIndex, optionIndex)}
                            className="mt-0.5"
                          />
                          <span className="min-w-0 flex-1">
                            <QuizRichText text={option} interactive={false} />
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  {exam.submitted && result ? (
                    <div
                      className={cn(
                        "mt-3 rounded-lg border px-3 py-2 text-xs",
                        result.correct
                          ? "border-ok-border bg-ok-bg text-ok-fg"
                          : "border-danger-border bg-danger-bg text-danger-fg"
                      )}
                    >
                      <span className="inline-flex items-start gap-1.5">
                        {result.correct ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> : <X className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />}
                        <span>
                          <strong>{result.correct ? "Correct" : "Not quite"}.</strong>{" "}
                          <QuizRichText
                            text={result.explanation || question.explanation}
                            draftKey={`exam:${exam.assessmentId}:e${questionIndex}`}
                          />
                        </span>
                      </span>
                    </div>
                  ) : null}
                </motion.fieldset>
              )
            })}
          </motion.div>
        </div>

        <footer className="shrink-0 border-t border-border bg-card p-4 sm:p-5">
          {exam.submitted ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                    exam.passed
                      ? "border-ok-border bg-ok-bg text-ok-fg"
                      : "border-danger-border bg-danger-bg text-danger-fg"
                  )}
                >
                  {exam.passed ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                  {exam.passed ? `Passed · ${exam.score}%` : `Scored ${exam.score}%`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {exam.passed
                    ? "Checkpoint requirement met."
                    : `Pass at ${PHASE_EXAM_PASS_THRESHOLD}% to meet the requirement.`}
                </span>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onNewAttempt}>
                  New attempt
                </Button>
                <Button type="button" size="sm" onClick={onClose}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {answered} of {exam.quiz.length} answered
              </p>
              <Button type="button" size="sm" onClick={onSubmit} disabled={!allAnswered || submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                    Grading…
                  </>
                ) : (
                  "Submit checkpoint"
                )}
              </Button>
            </div>
          )}
        </footer>
      </motion.section>
    </motion.div>,
    document.body
  )
}
