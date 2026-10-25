"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useState, useRef, useEffect } from "react"
import { loadRoadmap, loadRoadmapAsync, loadGam, loadProgress, loadWeakTopics, loadMasteryAsync, type WeakTopic } from "@/lib/store"
import type { LessonContent } from "@/lib/lesson-content-blocks"
import { TutorMessageBody } from "@/components/tutor/tutor-message-body"
import { PageTransition } from "@/components/motion/page-transition"
import { EmptyState } from "@/components/ui/empty-state"
import { useSearchParams } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Bot } from "lucide-react"
import { Suspense } from "react"
import { V2_MASTERY_THRESHOLD } from "@/lib/v2-mastery"

type Msg = { role:"user"|"assistant", content:string, blocks?: LessonContent | null }
type Thread = { id: string; title: string; roadmap_id: string | null; created_at: string }

function TutorContent() {
  const searchParams = useSearchParams()
  const { user } = useUser()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([])
  const [tutorMode, setTutorMode] = useState<"direct" | "socratic">("direct")
  const [lowMasteryTopics, setLowMasteryTopics] = useState<string[]>([])
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const refreshThreads = async () => {
    try {
      const res = await fetch("/api/chat/threads", { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as { threads?: Thread[] }
      setThreads(data.threads ?? [])
    } catch {
      // signed out or offline — stay in local-only mode
    }
  }

  useEffect(()=> {
    void refreshThreads()
    void loadWeakTopics().then(setWeakTopics).catch(() => {})
    try { const m = localStorage.getItem("hipath_tutor_mode"); if (m === "socratic" || m === "direct") setTutorMode(m) } catch {}
    void fetch("/api/me/preferences", { cache: "no-store" }).then(async (res) => {
      if (!res.ok) return
      const prefs = (await res.json()) as { tutorMode?: string }
      if (prefs.tutorMode === "socratic" || prefs.tutorMode === "direct") {
        setTutorMode(prefs.tutorMode)
        try { localStorage.setItem("hipath_tutor_mode", prefs.tutorMode) } catch {}
      }
    }).catch(() => {})
    void loadMasteryAsync().then((records) => setLowMasteryTopics(records.filter((r) => r.mastery_score < V2_MASTERY_THRESHOLD).map((r) => r.topic))).catch(() => {})
    // Server-first roadmap so progress answers are never stale (localStorage
    // may lag behind regeneration or another device).
    void loadRoadmapAsync().catch(() => {})
    // check for prefill from dashboard ?q= or localStorage
    const q = searchParams.get("q") || (()=>{ try { const v=localStorage.getItem("hipath_tutor_prefill"); if(v){ localStorage.removeItem("hipath_tutor_prefill"); return v } } catch{}; return null })()
    if (q) {
      setInput(q)
      // auto-send after a tick so user sees it
      const t = setTimeout(()=> { void sendMessage(q) }, 300)
      return () => clearTimeout(t)
    } else {
      setMessages([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(()=> {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const buildContext = () => {
    const roadmap = loadRoadmap()
    const gamNow = loadGam()
    const prog = loadProgress()
    // Globally numbered lessons with completion flags — the model must never
    // guess position or numbering (prod bug: "next lesson" named a done one).
    let n = 0
    const phases = (roadmap?.phases ?? []).map((p) => ({
      title: p.title.slice(0, 60),
      lessons: p.lessons.map((l) => {
        n += 1
        return { n, id: l.id, title: l.title.slice(0, 60), done: prog[l.id]?.completed === true }
      }),
    }))
    const flat = phases.flatMap((p) => p.lessons)
    const current = flat.find((l) => !l.done) ?? null
    const doneCount = flat.filter((l) => l.done).length
    // Recent quiz scores for targeted remediation — map progress lesson_ids to titles.
    const recentScores: { lessonTitle: string; score: number; passed: boolean }[] = []
    Object.entries(prog).forEach(([lessonId, p]) => {
      if (p.passed === false && p.score != null) {
        const found = flat.find((l) => l.id === lessonId)
        if (found) {
          recentScores.push({ lessonTitle: found.title, score: p.score, passed: false })
        }
      }
    })
    recentScores.sort((a, b) => b.score - a.score) // worst scores first
    const recentTop3 = recentScores.slice(0, 3)
    // Minutes since last study for streak nudge.
    const lastStudy = gamNow.lastStudyDate
    let minutesSinceLastStudy: number | undefined
    if (lastStudy) {
      const last = new Date(`${lastStudy}T00:00:00Z`).getTime()
      minutesSinceLastStudy = Math.max(0, (Date.now() - last) / 60000)
    }
    let lessonTitle: string | undefined
    let lessonContent: string | undefined
    try {
      const lid = localStorage.getItem("hipath_tutor_lessonId")
      if (lid && roadmap) {
        const found = roadmap.phases.flatMap((p) => p.lessons).find((l) => l.id === lid)
        if (found) {
          lessonTitle = found.title
          const txt = (found.contentMd || "").slice(0, 3000)
          if (txt.trim().length > 0) lessonContent = txt
        }
      }
    } catch {}
    return {
      roadmapTitle: roadmap?.title,
      phases,
      currentLesson: current ? { n: current.n, title: current.title } : null,
      level: gamNow.level,
      xp: gamNow.xp,
      streak: gamNow.streak,
      lessonsDone: doneCount,
      totalLessons: flat.length || roadmap?.totalLessons,
      weakTopics: weakTopics.map((w)=>w.topic).slice(0, 5),
      tutorMode,
      lowMasteryTopics: lowMasteryTopics.slice(0, 5),
      lessonTitle,
      lessonContent,
      recentScores: recentTop3,
      minutesSinceLastStudy,
    }
  }

  const sendMessage = async (text: string) => {
    const content = text.trim()
    if (!content || loading) return
    const userMsg: Msg = { role:"user", content }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput("")
    setLoading(true)
    try {
      // Lazy thread creation: persist the conversation from the first message
      let threadId = activeThreadId
      if (!threadId && user?.id) {
        try {
          const roadmap = loadRoadmap()
          const res = await fetch("/api/chat/threads", {
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ roadmapId: roadmap?.id ?? null })
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
      const timer = setTimeout(() => controller.abort(), 55000)
      let res: Response
      try {
        res = await fetch("/api/chat", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ messages: history, context: buildContext(), threadId }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }
      if (res.status === 429) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setMessages(m=> [...m, { role:"assistant", content: data?.error || "Too many chat requests. Please wait a bit and try again.", blocks: null }])
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || "api fail")
      }
      const data = (await res.json()) as { content?: string; blocks?: LessonContent | null; error?: string; threadId?: string | null }
      setMessages(m=> [...m, { role:"assistant", content: data.content || data.error || "I couldn't generate a response. Please try again.", blocks: data.blocks ?? null }])
      // Server titles new threads from the first question — refresh the list
      if (threadId) void refreshThreads()
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError"
      setMessages(m=> [...m, { role:"assistant", content: aborted
        ? `That took too long — the AI is busy. Please try again with a shorter question.`
        : `I couldn't reach the AI. Please check your connection and try again.`, blocks: null }])
    } finally { setLoading(false) }
  }

  const send = () => { void sendMessage(input) }

  const openThread = async (id: string) => {
    setActiveThreadId(id)
    setMessages([])
    try {
      const res = await fetch(`/api/chat/threads/${id}`, { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as { messages?: (Msg & { blocks?: LessonContent | null })[] }
      setMessages((data.messages ?? []).filter((m)=>m.role === "user" || m.role === "assistant").map((m)=> ({ role: m.role, content: m.content, blocks: (m as { blocks?: LessonContent | null }).blocks ?? null })))
    } catch {
      // keep the empty state on failure
    }
  }

  const newChat = () => {
    setActiveThreadId(null)
    setMessages([])
    setInput("")
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

  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 flex flex-col max-w-6xl w-full mx-auto p-4 sm:p-6 gap-4">
          <PageTransition className="flex-1 flex flex-col min-h-0">
          <div className="flex gap-4 flex-1 min-h-0">
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="bg-card rounded-xl border border-border p-4">
                <Button size="sm" className="w-full" onClick={newChat}>+ New Chat</Button>
                <div className="mt-4 space-y-1 max-h-[50vh] overflow-y-auto">
                  {threads.length === 0 ? (
                    <div className="text-center py-8"><EmptyState compact icon={Bot} title="No conversations yet" description="Start by asking a question." /></div>
                  ) : threads.map((t)=>(
                    <div key={t.id} className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs ${activeThreadId===t.id ? "bg-info-bg text-info-fg font-medium" : "text-muted-foreground hover:bg-muted"}`}>
                      <button onClick={()=> void openThread(t.id)} className="flex-1 text-left truncate">{t.title || "Untitled"}</button>
                      <button onClick={()=> setPendingDeleteId(t.id)} title="Delete conversation" aria-label="Delete conversation" className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-2 -m-1 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-muted-foreground hover:text-danger-fg">×</button>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
            <ConfirmDialog
              open={pendingDeleteId !== null}
              title="Delete conversation?"
              description="This chat history will be permanently removed."
              confirmLabel="Delete"
              danger
              onConfirm={()=> { if (pendingDeleteId) void deleteThread(pendingDeleteId) }}
              onClose={()=> setPendingDeleteId(null)}
            />
            <div className="flex-1 flex flex-col bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border flex justify-between items-center">
                <div><div className="font-semibold text-sm">Tutor · Persistent memory</div><div className="text-xs text-muted-foreground">Your AI mentor remembers your progress</div></div>
              </div>
              {threads.length > 0 && (
                <div className="lg:hidden flex gap-2 overflow-x-auto px-4 py-2 border-b">
                  <button onClick={newChat} className="shrink-0 text-xs border border-border rounded-full px-3 py-1.5 hover:bg-muted">+ New</button>
                  {threads.map((t)=>(
                    <button
                      key={t.id}
                      onClick={()=> void openThread(t.id)}
                      className={`shrink-0 text-xs rounded-full px-3 py-1.5 border max-w-40 truncate ${activeThreadId===t.id ? "bg-info-bg border-primary text-info-fg" : "hover:bg-muted"}`}
                    >
                      {t.title || "Untitled"}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length===0 && !loading && (
                  <EmptyState
                    icon={Bot}
                    title="Start a conversation"
                    description="Ask about any concept, lesson, or problem to get started."
                    action={
                      <div className="flex flex-wrap gap-2 justify-center">
                        {["Explain my current lesson", "Give me a practice question", "I am stuck on an error"].map((prompt) => (
                          <button
                            key={prompt}
                            onClick={() => void sendMessage(prompt)}
                            className="text-xs border border-border rounded-full px-3 py-1.5 hover:bg-muted"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    }
                  />
                )}
                {messages.map((m,i)=>(
                  <div key={i} className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${m.role==="user"?"bg-primary text-primary-foreground ml-auto":"bg-muted"}`}>{m.blocks ? <TutorMessageBody doc={m.blocks} /> : m.content}</div>
                ))}
                {loading && (
                  <div role="status" aria-live="polite" className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Tutor is thinking">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                    <span className="ml-1">Thinking…</span>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              <div className="p-3 border-t border-border flex gap-2 items-center">
                <div className="relative flex-1">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e=>setInput(e.target.value)}
                    onKeyDown={e=> {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        send()
                      }
                    }}
                    placeholder="Ask about a concept, lesson, or problem…"
                    aria-label="Ask the tutor"
                    rows={4}
                    className="w-full min-h-[120px] max-h-[280px] rounded-2xl border border-border bg-card px-4 py-3 text-sm resize-y focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                  />
                </div>
                <Button onClick={send} disabled={loading || !input.trim()}>
                  {loading ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          </div>
          </PageTransition>
        </main>
      </div>
    </div>
  )
}

export default function TutorPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen bg-app"><div className="flex-1 p-8"><div className="animate-pulse h-8 bg-muted rounded w-1/3"/></div></div>}>
      <TutorContent />
    </Suspense>
  )
}
