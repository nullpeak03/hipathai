"use client"

import { useCallback, useEffect, useMemo, useRef, useState, Suspense, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import {
  ArrowRight,
  BookOpen,
  History,
  Lightbulb,
  ListChecks,
  Plus,
  SquareCode,
  X,
  type LucideIcon,
} from "lucide-react"

import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { TutorMessageBody } from "@/components/tutor/tutor-message-body"
import { TutorQuizCard } from "@/components/tutor/tutor-quiz-card"
import { TutorSidePanel } from "@/components/tutor/tutor-side-panel"
import type { LessonContent } from "@/lib/lesson-content-blocks"
import {
  FRESH_GAM,
  loadDueReviews,
  loadGam,
  loadGamAsync,
  loadMasteryAsync,
  loadProgress,
  loadProgressAsync,
  loadRoadmap,
  loadRoadmapAsync,
  loadWeakTopics,
  type Gamification,
  type Progress,
  type ReviewItem,
  type RoadmapData,
  type WeakTopic,
} from "@/lib/store"
import { V2_MASTERY_THRESHOLD } from "@/lib/v2-mastery"
import { cn } from "@/lib/utils"

type Msg = { role: "user" | "assistant"; content: string; blocks?: LessonContent | null }
type Thread = { id: string; title: string; roadmap_id: string | null; created_at: string }
type TutorMode = "ask" | "hint" | "check"

const MODE_HINTS: Record<TutorMode, string> = {
  ask: "Ask anything. I’ll try to teach, not just tell.",
  hint: "Hint mode gives one small step at a time. Press / to focus.",
  check: "Add your code and I’ll review it without just rewriting it.",
}

function threadDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  if (date.toDateString() === new Date().toDateString()) return "Today"
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function TutorAvatar() {
  return (
    <div className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[7px] bg-primary text-xs font-semibold text-primary-foreground">
      H
    </div>
  )
}

/** User text with fenced code rendered as a compact dark panel. */
function UserText({ content }: { content: string }) {
  const parts = content.split(/```(\w*)\r?\n([\s\S]*?)```/g)
  if (parts.length === 1) return <span className="whitespace-pre-wrap break-words">{content}</span>

  const nodes: ReactNode[] = []
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i] ?? ""
    if (i % 3 === 2) {
      const language = parts[i - 1] || "code"
      nodes.push(
        <div key={i} className="my-2 overflow-hidden rounded-lg bg-zinc-900 text-zinc-100">
          <div className="border-b border-white/10 px-3 py-1 text-[11px] text-zinc-400">{language}</div>
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">{part.replace(/\n$/, "")}</pre>
        </div>
      )
    } else if (i % 3 === 0 && part.trim()) {
      nodes.push(
        <span key={i} className="whitespace-pre-wrap break-words">
          {part.trim()}
        </span>
      )
    }
  }
  return <>{nodes}</>
}

function Suggestion({
  icon: Icon,
  label,
  tag,
  onClick,
}: {
  icon: LucideIcon
  label: string
  tag: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 border-t border-border px-3.5 py-3 text-left text-sm first:border-t-0 hover:bg-muted"
    >
      <Icon className="h-[18px] w-[18px] shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <small className="shrink-0 text-xs text-muted-foreground">{tag}</small>
    </button>
  )
}

function TutorContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useUser()

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [code, setCode] = useState("")
  const [codeOpen, setCodeOpen] = useState(false)
  const [mode, setMode] = useState<TutorMode>("ask")
  const [loading, setLoading] = useState(false)

  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null)
  const [progress, setProgress] = useState<Progress>({})
  // Start from the deterministic SSR value, then hydrate from storage/server
  // in the effect below (avoids a hydration mismatch on the footer).
  const [gam, setGam] = useState<Gamification>(FRESH_GAM)
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([])
  const [lowMasteryTopics, setLowMasteryTopics] = useState<string[]>([])
  const [storedLessonId, setStoredLessonId] = useState<string | null>(null)

  const [panelTab, setPanelTab] = useState<"lesson" | "review">("lesson")
  const [sideOpen, setSideOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [quizOpen, setQuizOpen] = useState(false)
  // Freeze the quiz's lesson while it runs: passing it refreshes progress and
  // moves the "current" lesson, which must not reset the result card.
  const [quizLesson, setQuizLesson] = useState<{ id: string; title: string; hasBank: boolean } | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const codeRef = useRef<HTMLTextAreaElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)

  const allLessons = useMemo(
    () => roadmap?.phases.flatMap((phase) => phase.lessons.map((lesson) => ({ lesson, phase }))) ?? [],
    [roadmap]
  )
  const current = useMemo(() => {
    if (allLessons.length === 0) return null
    const stored = storedLessonId ? allLessons.find((entry) => entry.lesson.id === storedLessonId) : null
    return stored ?? allLessons.find((entry) => !progress[entry.lesson.id]?.completed) ?? allLessons[0] ?? null
  }, [allLessons, storedLessonId, progress])
  const activeTitle = threads.find((thread) => thread.id === activeThreadId)?.title || "New chat"
  const topic = current?.lesson.title ?? "your current lesson"

  const refreshThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/threads", { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as { threads?: Thread[] }
      setThreads(data.threads ?? [])
    } catch {
      // signed out or offline — stay in local-only mode
    }
  }, [])

  const refreshLearningData = useCallback(async () => {
    const [nextProgress, nextGam, nextReviews] = await Promise.all([
      loadProgressAsync().catch(() => loadProgress()),
      loadGamAsync().catch(() => loadGam()),
      loadDueReviews().catch(() => [] as ReviewItem[]),
    ])
    setProgress(nextProgress)
    setGam(nextGam)
    setReviews(nextReviews)
    void loadWeakTopics().then(setWeakTopics).catch(() => {})
    void loadMasteryAsync()
      .then((records) => setLowMasteryTopics(records.filter((record) => record.mastery_score < V2_MASTERY_THRESHOLD).map((record) => record.topic)))
      .catch(() => {})
  }, [])

  const buildContext = () => {
    const localRoadmap = roadmap ?? loadRoadmap()
    const gamNow = loadGam()
    const prog = loadProgress()
    // Globally numbered lessons with completion flags — the model must never
    // guess position or numbering (prod bug: "next lesson" named a done one).
    let n = 0
    const phases = (localRoadmap?.phases ?? []).map((phase) => ({
      title: phase.title.slice(0, 60),
      lessons: phase.lessons.map((lesson) => {
        n += 1
        return { n, id: lesson.id, title: lesson.title.slice(0, 60), done: prog[lesson.id]?.completed === true }
      }),
    }))
    const flat = phases.flatMap((phase) => phase.lessons)
    const currentEntry = current
      ? { n: Math.max(1, allLessons.findIndex((entry) => entry.lesson.id === current.lesson.id) + 1), title: current.lesson.title }
      : null
    const doneCount = flat.filter((lesson) => lesson.done).length

    // Recent quiz scores for targeted remediation — map progress lesson_ids to titles.
    const recentScores: { lessonTitle: string; score: number; passed: boolean }[] = []
    Object.entries(prog).forEach(([lessonId, record]) => {
      if (record.passed === false && record.score != null) {
        const found = flat.find((lesson) => lesson.id === lessonId)
        if (found) recentScores.push({ lessonTitle: found.title, score: record.score, passed: false })
      }
    })
    recentScores.sort((a, b) => b.score - a.score) // worst scores first

    const lastStudy = gamNow.lastStudyDate
    let minutesSinceLastStudy: number | undefined
    if (lastStudy) {
      const last = new Date(`${lastStudy}T00:00:00Z`).getTime()
      minutesSinceLastStudy = Math.max(0, (Date.now() - last) / 60000)
    }

    return {
      roadmapTitle: localRoadmap?.title,
      phases,
      currentLesson: currentEntry,
      level: gamNow.level,
      xp: gamNow.xp,
      streak: gamNow.streak,
      lessonsDone: gamNow.lessonsDone || doneCount,
      totalLessons: flat.length || localRoadmap?.totalLessons,
      weakTopics: weakTopics.map((entry) => entry.topic).slice(0, 5),
      tutorMode: mode === "hint" ? "socratic" : "direct",
      lowMasteryTopics: lowMasteryTopics.slice(0, 5),
      lessonTitle: current?.lesson.title,
      lessonContent: current?.lesson.contentMd?.slice(0, 3000) || undefined,
      recentScores: recentScores.slice(0, 3),
      minutesSinceLastStudy,
    }
  }

  const sendMessage = async (text: string, options?: { code?: string; mode?: TutorMode }) => {
    const activeMode = options?.mode ?? mode
    const content = text.trim()
    const codeText = (options?.code ?? code).trim()

    if (activeMode === "check" && !codeText) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: "Add your code with “+ Code” and I’ll review it. I’ll point to what to fix before showing a solution.",
          blocks: null,
        },
      ])
      setCodeOpen(true)
      window.setTimeout(() => codeRef.current?.focus(), 50)
      return
    }

    const userContent = codeText
      ? `${content || (activeMode === "check" ? "Please review my code." : "Here is my code.")}\n\n\`\`\`\n${codeText}\n\`\`\``
      : content
    if (!userContent || loading) return

    const userMsg: Msg = { role: "user", content: userContent }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput("")
    setCode("")
    setCodeOpen(false)
    setQuizOpen(false)
    setQuizLesson(null)
    setLoading(true)

    try {
      // Lazy thread creation: persist the conversation from the first message
      let threadId = activeThreadId
      if (!threadId && user?.id) {
        try {
          const localRoadmap = loadRoadmap()
          const res = await fetch("/api/chat/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roadmapId: localRoadmap?.id ?? null }),
          })
          if (res.ok) {
            const data = (await res.json()) as { thread?: Thread }
            if (data.thread) {
              threadId = data.thread.id
              setActiveThreadId(threadId)
            }
          }
        } catch {
          // fall back to unpersisted chat
        }
      }

      // Client-side ceiling just under the route's 60s cap: a killed request
      // surfaces as a friendly retry note, never an endless spinner.
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), 55000)
      let res: Response
      try {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            context: { ...buildContext(), tutorMode: activeMode === "hint" ? "socratic" : "direct" },
            threadId,
          }),
          signal: controller.signal,
        })
      } finally {
        window.clearTimeout(timer)
      }

      if (res.status === 429) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: data?.error || "Too many chat requests. Please wait a bit and try again.", blocks: null },
        ])
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || "api fail")
      }

      const data = (await res.json()) as { content?: string; blocks?: LessonContent | null; error?: string; threadId?: string | null }
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: data.content || data.error || "I couldn't generate a response. Please try again.",
          blocks: data.blocks ?? null,
        },
      ])
      // Server titles new threads from the first question — refresh the list
      if (threadId) void refreshThreads()
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError"
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: aborted
            ? "That took too long — the AI is busy. Please try again with a shorter question."
            : "I couldn't reach the AI. Please check your connection and try again.",
          blocks: null,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const openThread = async (id: string) => {
    setActiveThreadId(id)
    setMessages([])
    setQuizOpen(false)
    setQuizLesson(null)
    try {
      const res = await fetch(`/api/chat/threads/${id}`, { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as { messages?: (Msg & { blocks?: LessonContent | null })[] }
      setMessages(
        (data.messages ?? [])
          .filter((message) => message.role === "user" || message.role === "assistant")
          .map((message) => ({ role: message.role, content: message.content, blocks: message.blocks ?? null }))
      )
    } catch {
      // keep the empty state on failure
    }
  }

  const newChat = () => {
    setActiveThreadId(null)
    setMessages([])
    setInput("")
    setCode("")
    setCodeOpen(false)
    setQuizOpen(false)
    setQuizLesson(null)
    window.setTimeout(() => textareaRef.current?.focus(), 20)
  }

  const deleteThread = async (id: string) => {
    setPendingDeleteId(null)
    try {
      await fetch(`/api/chat/threads/${id}`, { method: "DELETE" })
    } catch {
      // refresh anyway
    }
    if (activeThreadId === id) newChat()
    void refreshThreads()
  }

  const changeMode = (next: TutorMode) => {
    setMode(next)
    try {
      localStorage.setItem("hipath_tutor_mode", next === "hint" ? "socratic" : "direct")
    } catch {
      // ignore
    }
  }

  const startQuiz = () => {
    if (!current) {
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: "Open a lesson from your roadmap first, then ask me to quiz you.", blocks: null },
      ])
      return
    }
    setQuizLesson({ id: current.lesson.id, title: current.lesson.title, hasBank: current.lesson.hasQuizBank === true })
    setQuizOpen(true)
    window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 30)
  }

  const startReview = () => {
    const first = reviews[0]
    if (!first) return
    setSideOpen(false)
    router.push(`/roadmap/${first.roadmapId}/lesson/${first.lessonId}`)
  }

  const openLesson = () => {
    setSideOpen(false)
    if (roadmap && current) router.push(`/roadmap/${roadmap.id}/lesson/${current.lesson.id}`)
    else router.push("/roadmap")
  }

  const send = () => {
    void sendMessage(input)
  }

  // Initial data load: threads, roadmap, progress, gamification, reviews,
  // weak topics, mastery, and the learner's saved tutor mode.
  useEffect(() => {
    void refreshThreads()
    void (async () => {
      const [nextRoadmap, nextProgress, nextGam, nextReviews] = await Promise.all([
        loadRoadmapAsync().catch(() => loadRoadmap()),
        loadProgressAsync().catch(() => loadProgress()),
        loadGamAsync().catch(() => loadGam()),
        loadDueReviews().catch(() => [] as ReviewItem[]),
      ])
      setRoadmap(nextRoadmap)
      setProgress(nextProgress)
      setGam(nextGam)
      setReviews(nextReviews)
      void loadWeakTopics().then(setWeakTopics).catch(() => {})
      void loadMasteryAsync()
        .then((records) => setLowMasteryTopics(records.filter((record) => record.mastery_score < V2_MASTERY_THRESHOLD).map((record) => record.topic)))
        .catch(() => {})
    })()
    try {
      setStoredLessonId(localStorage.getItem("hipath_tutor_lessonId"))
      if (localStorage.getItem("hipath_tutor_mode") === "socratic") setMode("hint")
    } catch {
      // ignore
    }
    void fetch("/api/me/preferences", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return
        const prefs = (await res.json()) as { tutorMode?: string }
        if (prefs.tutorMode === "socratic") setMode("hint")
        else if (prefs.tutorMode === "direct") setMode("ask")
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Prefill from dashboard search (?q=) or the lesson-page hand-off.
  useEffect(() => {
    const fromQuery = searchParams.get("q")
    const fromStorage = (() => {
      try {
        const value = localStorage.getItem("hipath_tutor_prefill")
        if (value) {
          localStorage.removeItem("hipath_tutor_prefill")
          return value
        }
      } catch {
        // ignore
      }
      return null
    })()
    const prompt = fromQuery || fromStorage
    if (!prompt) return
    setInput(prompt)
    const timer = window.setTimeout(() => void sendMessage(prompt), 300)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, loading, quizOpen])

  // Grow the composer with its content, capped like the design.
  useEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = "auto"
    element.style.height = `${Math.min(element.scrollHeight, 140)}px`
  }, [input])

  // Keyboard shortcuts: "/" focuses the composer, Escape closes overlays.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName ?? ""
      if (event.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(tag)) {
        event.preventDefault()
        textareaRef.current?.focus()
      }
      if (event.key === "Escape") {
        setHistoryOpen(false)
        setSideOpen(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // Close the history popover on outside click.
  useEffect(() => {
    if (!historyOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) setHistoryOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [historyOpen])

  const sidePanel = (onClose?: () => void) => (
    <TutorSidePanel
      roadmap={roadmap}
      current={current}
      progress={progress}
      gam={gam}
      reviews={reviews}
      weakTopics={weakTopics}
      lowMasteryTopics={lowMasteryTopics}
      tab={panelTab}
      onTabChange={setPanelTab}
      onStartReview={startReview}
      onOpenLesson={openLesson}
      onClose={onClose}
    />
  )

  return (
    <div className="flex h-dvh overflow-hidden bg-app">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <div className="flex min-h-0 flex-1">
          <section className="flex min-w-0 flex-1 flex-col bg-app" aria-label="Tutor chat">
            {/* Chat header: title · lesson, history, new chat, lesson panel */}
            <div className="flex shrink-0 items-center gap-1.5 border-b border-border bg-card px-3 py-2 sm:gap-2 sm:px-5">
              <div className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="truncate text-sm font-semibold">{activeTitle}</span>
                {current && <span className="truncate text-xs text-muted-foreground">· {current.lesson.title}</span>}
              </div>

              <div className="relative" ref={historyRef}>
                <button
                  onClick={() => setHistoryOpen((open) => !open)}
                  aria-expanded={historyOpen}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <History className="h-4 w-4" />
                  <span className="hidden sm:inline">History</span>
                </button>
                {historyOpen && (
                  <div className="absolute right-0 top-full z-30 mt-1.5 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                    <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      History
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto p-2">
                      {threads.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-muted-foreground">No earlier chats yet.</p>
                      ) : (
                        threads.map((thread) => (
                          <div
                            key={thread.id}
                            className={cn(
                              "group flex items-center gap-1 rounded-lg px-2 py-1",
                              activeThreadId === thread.id ? "bg-info-bg text-info-fg" : "hover:bg-muted"
                            )}
                          >
                            <button
                              onClick={() => {
                                setHistoryOpen(false)
                                void openThread(thread.id)
                              }}
                              className="min-w-0 flex-1 py-1 text-left"
                            >
                              <span className="block truncate text-xs font-medium">{thread.title || "Untitled"}</span>
                              <span className="block text-[11px] text-muted-foreground">{threadDate(thread.created_at)}</span>
                            </button>
                            <button
                              onClick={() => {
                                setHistoryOpen(false)
                                setPendingDeleteId(thread.id)
                              }}
                              aria-label="Delete conversation"
                              className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md text-muted-foreground opacity-100 hover:text-danger-fg sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setHistoryOpen(false)
                        newChat()
                      }}
                      className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" /> New chat
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={newChat}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New chat</span>
              </button>

              <button
                onClick={() => setSideOpen(true)}
                aria-label="Open lesson panel"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground xl:hidden"
              >
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Lesson</span>
              </button>
            </div>

            {/* Messages */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-6 sm:px-5 sm:pt-7">
              <div className="mx-auto flex max-w-[700px] flex-col gap-[22px]">
                {messages.length === 0 && !loading && !quizOpen && (
                  <div className="mx-auto mt-[7vh] w-full max-w-[560px]">
                    <h1 className="text-2xl font-semibold tracking-[-0.02em]">What are you working on?</h1>
                    <p className="mb-5 mt-1.5 text-sm text-muted-foreground">
                      I know you’re on {current ? `“${current.lesson.title}”` : "your roadmap"}. I’ll ask you to try first, then help.
                    </p>
                    <div className="overflow-hidden rounded-xl border border-border bg-card">
                      <Suggestion
                        icon={BookOpen}
                        label={`Explain ${topic}`}
                        tag="Teach"
                        onClick={() => void sendMessage(`Explain ${topic}.`)}
                      />
                      <Suggestion
                        icon={Lightbulb}
                        label="Give me a hint on today’s exercise"
                        tag="Hint"
                        onClick={() => {
                          changeMode("hint")
                          void sendMessage(
                            `Give me a hint on today’s exercise${current ? ` from ${current.lesson.title}` : ""}.`,
                            { mode: "hint" }
                          )
                        }}
                      />
                      <Suggestion
                        icon={SquareCode}
                        label="Check my code"
                        tag="Check"
                        onClick={() => {
                          changeMode("check")
                          setCodeOpen(true)
                          window.setTimeout(() => codeRef.current?.focus(), 50)
                        }}
                      />
                      <Suggestion icon={ListChecks} label={`Quiz me on ${topic}`} tag="Quiz" onClick={startQuiz} />
                    </div>
                  </div>
                )}

                {messages.map((message, index) =>
                  message.role === "user" ? (
                    <div
                      key={index}
                      className="ml-auto max-w-[85%] rounded-xl border border-border bg-muted px-3.5 py-2 text-sm shadow-sm"
                    >
                      <UserText content={message.content} />
                    </div>
                  ) : (
                    <div key={index} className="grid grid-cols-[26px_1fr] gap-3">
                      <TutorAvatar />
                      <div className="min-w-0 text-sm leading-relaxed">
                        {message.blocks ? (
                          <TutorMessageBody doc={message.blocks} />
                        ) : (
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        )}
                      </div>
                    </div>
                  )
                )}

                {loading && (
                  <div className="grid grid-cols-[26px_1fr] gap-3" role="status" aria-live="polite">
                    <TutorAvatar />
                    <div className="flex items-center text-sm text-muted-foreground">
                      <span className="tutor-caret">Thinking</span>
                    </div>
                  </div>
                )}

                {quizOpen && quizLesson && (
                  <div className="grid grid-cols-[26px_1fr] gap-3">
                    <TutorAvatar />
                    <div className="min-w-0">
                      <TutorQuizCard
                        lessonId={quizLesson.id}
                        lessonTitle={quizLesson.title}
                        hasBank={quizLesson.hasBank}
                        onOpenReview={() => {
                          setPanelTab("review")
                          setSideOpen(true)
                        }}
                        onOpenLesson={openLesson}
                        onClose={() => {
                          setQuizOpen(false)
                          setQuizLesson(null)
                        }}
                        onGraded={() => void refreshLearningData()}
                      />
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </div>

            {/* Composer */}
            <div className="shrink-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5">
              <div className="mx-auto max-w-[700px] rounded-2xl border border-border bg-card transition-colors focus-within:border-primary">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      send()
                    }
                  }}
                  rows={1}
                  placeholder="Ask, or tell me where you’re stuck"
                  aria-label="Message"
                  className="block max-h-[140px] w-full resize-none border-0 bg-transparent px-3.5 pb-1 pt-3 text-sm outline-none placeholder:text-muted-foreground"
                />
                {codeOpen && (
                  <textarea
                    ref={codeRef}
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    rows={4}
                    placeholder="Paste your code here"
                    aria-label="Your code"
                    className="block w-full resize-y border-t border-dashed border-border bg-muted px-3.5 py-2.5 font-mono text-xs outline-none placeholder:text-muted-foreground"
                  />
                )}
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label="Tutor mode">
                    {(["ask", "hint", "check"] as const).map((value) => (
                      <button
                        key={value}
                        onClick={() => changeMode(value)}
                        aria-pressed={mode === value}
                        className={cn(
                          "h-[26px] rounded-md px-2.5 text-[13px] transition-colors",
                          mode === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {value === "ask" ? "Ask" : value === "hint" ? "Hint" : "Check my work"}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      if (codeOpen) {
                        setCodeOpen(false)
                        setCode("")
                      } else {
                        setCodeOpen(true)
                        window.setTimeout(() => codeRef.current?.focus(), 30)
                      }
                    }}
                    aria-pressed={codeOpen}
                    className="inline-flex h-[30px] items-center gap-1 rounded-lg border border-border px-2.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" /> Code
                  </button>
                  <span className="flex-1" />
                  <button
                    onClick={send}
                    disabled={loading || (!input.trim() && !code.trim())}
                    aria-label="Send"
                    className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
                  >
                    {loading ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <p className="mx-auto mt-1.5 max-w-[700px] text-center text-xs text-muted-foreground">{MODE_HINTS[mode]}</p>
            </div>
          </section>

          <div className="hidden w-[340px] shrink-0 border-l border-border xl:flex">{sidePanel()}</div>
        </div>
      </div>

      {sideOpen && (
        <div className="fixed inset-0 z-40 xl:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSideOpen(false)} />
          <div className="absolute bottom-0 right-0 top-0 flex w-[min(340px,92vw)] shadow-2xl">{sidePanel(() => setSideOpen(false))}</div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete conversation?"
        description="This chat history will be permanently removed."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (pendingDeleteId) void deleteThread(pendingDeleteId)
        }}
        onClose={() => setPendingDeleteId(null)}
      />
    </div>
  )
}

export default function TutorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh overflow-hidden bg-app">
          <div className="hidden w-56 border-r border-border bg-app md:block" />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="h-14 border-b border-border bg-card" />
            <div className="flex min-h-0 flex-1">
              <div className="flex-1 p-6">
                <div className="mx-auto h-8 w-1/3 animate-pulse rounded bg-muted" />
              </div>
              <div className="hidden w-[340px] animate-pulse border-l border-border bg-card xl:block" />
            </div>
          </div>
        </div>
      }
    >
      <TutorContent />
    </Suspense>
  )
}
