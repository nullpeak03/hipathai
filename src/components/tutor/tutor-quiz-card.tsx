"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, ArrowRight, BookOpen, Check, Loader2, RotateCcw, X } from "lucide-react"
import { requestQuiz, submitAssessment } from "@/lib/store"
import type { AssessmentResult, IssuedAssessment } from "@/lib/assessment"
import { splitQuizCodeSpans } from "@/lib/quiz"
import { cn } from "@/lib/utils"

function InlineCode({ text }: { text: string }) {
  const parts = text.split(/`([^`]+)`/g)
  if (parts.length === 1) return <>{text}</>
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <code key={index} className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">
            {part}
          </code>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  )
}

/** Lightweight quiz text renderer — keeps the tutor chat bundle free of the
 * heavy code editor while still rendering fenced code and inline code nicely. */
function QuizText({ text }: { text: string }) {
  const spans = splitQuizCodeSpans(text)
  return (
    <span>
      {spans.map((span, index) =>
        span.kind === "code" ? (
          <span key={index} className="my-2 block overflow-hidden rounded-lg border border-border bg-muted">
            <pre className="overflow-x-auto px-3 py-2 font-mono text-[12.5px] leading-relaxed">{span.code}</pre>
          </span>
        ) : (
          <InlineCode key={index} text={span.text} />
        )
      )}
    </span>
  )
}

type Props = {
  lessonId: string | null
  lessonTitle: string
  hasBank: boolean
  onOpenReview: () => void
  onOpenLesson: () => void
  onClose: () => void
  onGraded: () => void
}

/** In-chat quiz card matching the Tutor design. Grading uses the real
 * assessment API; feedback is revealed once every question is answered. */
export function TutorQuizCard({ lessonId, lessonTitle, hasBank, onOpenReview, onOpenLesson, onClose, onGraded }: Props) {
  const [issued, setIssued] = useState<IssuedAssessment | null>(null)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [result, setResult] = useState<AssessmentResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  useEffect(() => {
    let cancelled = false
    setIssued(null)
    setResult(null)
    setError("")
    setSubmitError("")
    setIndex(0)
    setAnswers({})
    if (!lessonId) {
      setError("Open a lesson first, then ask me to quiz you.")
      return () => { cancelled = true }
    }
    if (!hasBank) {
      setError("This lesson doesn’t have a quiz yet. Open the lesson and generate its quiz first.")
      return () => { cancelled = true }
    }
    setStatus("Preparing your quiz…")
    void requestQuiz(lessonId, "standard", (message) => {
      if (!cancelled) setStatus(message)
    }).then((next) => {
      if (cancelled) return
      setStatus("")
      if (!next) {
        setError("I couldn’t prepare a quiz for this lesson. Please try again from the lesson page.")
        return
      }
      setIssued(next)
    })
    return () => { cancelled = true }
  }, [lessonId, hasBank, attempt])

  const submit = async () => {
    if (!issued) return
    setSubmitting(true)
    setSubmitError("")
    const graded = await submitAssessment(issued.assessmentId, answers)
    setSubmitting(false)
    if (!graded) {
      setSubmitError("Your answers couldn’t be graded. Please check your connection and try again.")
      return
    }
    setResult(graded)
    onGraded()
  }

  if (error && !issued) {
    const needsLesson = !lessonId || !hasBank
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="h-4 w-4 text-warn-fg" /> Quiz unavailable
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{error}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {needsLesson ? (
            <button onClick={onOpenLesson} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
              <BookOpen className="h-3.5 w-3.5" /> Open lesson
            </button>
          ) : (
            <button onClick={() => setAttempt((value) => value + 1)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
              <RotateCcw className="h-3.5 w-3.5" /> Try again
            </button>
          )}
          <button onClick={onClose} className="h-9 rounded-lg border border-border px-4 text-sm hover:bg-muted">Close</button>
        </div>
      </div>
    )
  }

  if (!issued) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {status || "Preparing your quiz…"}
        </div>
        <div className="mt-3 flex gap-1" aria-hidden>
          {[0, 1, 2].map((segment) => (
            <span key={segment} className="h-[3px] flex-1 rounded-full bg-border" />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Building questions from {lessonTitle || "this lesson"}.</p>
      </div>
    )
  }

  if (result) {
    const correct = result.results.filter((entry) => entry.correct).length
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Result</div>
        <h4 className="mt-1 text-[15px] font-semibold">{correct} of {result.results.length} correct · {result.score}%</h4>
        <p className={cn("mt-1 text-sm", result.passed ? "text-ok-fg" : "text-muted-foreground")}>
          {result.passed
            ? "You passed (60% or more). The next lesson is unlocked."
            : "Below 60%. Review the topics in your queue, then try again."}
        </p>
        <div className="mt-3 space-y-2">
          {result.results.map((entry, questionIndex) => (
            <div key={questionIndex} className={cn("rounded-lg p-2.5 text-sm", entry.correct ? "bg-ok-bg" : "bg-danger-bg")}>
              <div className={cn("flex items-center gap-1.5 font-medium", entry.correct ? "text-ok-fg" : "text-danger-fg")}>
                {entry.correct ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                Question {questionIndex + 1}
              </div>
              {entry.explanation && (
                <div className="mt-1 text-xs text-muted-foreground">
                  <QuizText text={entry.explanation} />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={onOpenReview} className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
            Open review queue
          </button>
          <button onClick={onClose} className="h-9 rounded-lg border border-border px-4 text-sm hover:bg-muted">Close</button>
        </div>
      </div>
    )
  }

  const question = issued.quiz[index]
  if (!question) return null
  const selected = answers[index]
  const isLast = index === issued.quiz.length - 1

  const select = (optionIndex: number) => {
    setAnswers((previous) => ({ ...previous, [index]: optionIndex }))
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex gap-1" aria-hidden>
        {issued.quiz.map((_, segment) => (
          <span key={segment} className={cn("h-[3px] flex-1 rounded-full", segment <= index ? "bg-primary" : "bg-border")} />
        ))}
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Question {index + 1} of {issued.quiz.length}
      </div>
      <h4 className="mb-2.5 mt-1 text-[15px] font-semibold">
        <QuizText text={question.q} />
      </h4>

      <div className="grid gap-1.5" role="radiogroup" aria-label={`Question ${index + 1} options`}>
        {question.options.map((option, optionIndex) => (
          <div
            key={optionIndex}
            role="radio"
            aria-checked={selected === optionIndex}
            tabIndex={0}
            onClick={() => select(optionIndex)}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                select(optionIndex)
                return
              }
              if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) {
                event.preventDefault()
                const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1
                const next = (optionIndex + step + question.options.length) % question.options.length
                select(next)
                const group = event.currentTarget.parentElement
                group?.querySelectorAll<HTMLElement>("[role=radio]")[next]?.focus()
              }
            }}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
              selected === optionIndex ? "border-primary bg-info-bg" : "border-border hover:border-primary"
            )}
          >
            <span className="min-w-0 flex-1">
              <QuizText text={option} />
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
        <button
          disabled={selected === undefined || submitting}
          onClick={() => {
            if (!isLast) setIndex((value) => value + 1)
            else void submit()
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-40"
        >
          {submitting ? "Grading…" : isLast ? "See result" : "Next question"}
          {!submitting && <ArrowRight className="h-3.5 w-3.5" />}
        </button>
      </div>
      {submitError && <p className="mt-2 text-xs text-danger-fg" role="alert">{submitError}</p>}
    </div>
  )
}
