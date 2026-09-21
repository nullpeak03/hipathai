"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useState, useRef, useEffect } from "react"
import { loadRoadmap, loadGam, loadProgress, loadWeakTopics, type WeakTopic } from "@/lib/store"
import { useSearchParams } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Suspense } from "react"

type Msg = { role:"user"|"assistant", content:string }
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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

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
    const done = Object.values(prog).filter((p)=>p.completed).length
    return {
      roadmapTitle: roadmap?.title,
      level: gamNow.level,
      xp: gamNow.xp,
      streak: gamNow.streak,
      lessonsDone: done,
      totalLessons: roadmap?.totalLessons,
      weakTopics: weakTopics.map((w)=>w.topic).slice(0, 5),
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
      const res = await fetch("/api/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ messages: history, context: buildContext(), threadId })
      })
      if (!res.ok) throw new Error("api fail")
      const data = (await res.json()) as { content?: string; error?: string; threadId?: string | null }
      setMessages(m=> [...m, { role:"assistant", content: data.content || data.error || "I couldn't generate a response. Please try again." }])
      // Server titles new threads from the first question — refresh the list
      if (threadId) void refreshThreads()
    } catch {
      setMessages(m=> [...m, { role:"assistant", content: `I couldn't reach the AI. Please check your connection and try again.` }])
    } finally { setLoading(false) }
  }

  const send = () => { void sendMessage(input) }

  const openThread = async (id: string) => {
    setActiveThreadId(id)
    setMessages([])
    try {
      const res = await fetch(`/api/chat/threads/${id}`, { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as { messages?: Msg[] }
      setMessages((data.messages ?? []).filter((m)=>m.role === "user" || m.role === "assistant"))
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
          <div className="flex gap-4 flex-1 min-h-0">
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="bg-card rounded-xl border border-border p-4">
                <Button size="sm" className="w-full" onClick={newChat}>+ New Chat</Button>
                <div className="mt-4 space-y-1 max-h-[50vh] overflow-y-auto">
                  {threads.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-8">No conversations yet. Start by asking a question.</div>
                  ) : threads.map((t)=>(
                    <div key={t.id} className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs ${activeThreadId===t.id ? "bg-info-bg text-info-fg font-medium" : "text-muted-foreground hover:bg-muted"}`}>
                      <button onClick={()=> void openThread(t.id)} className="flex-1 text-left truncate">{t.title || "Untitled"}</button>
                      <button onClick={()=> setPendingDeleteId(t.id)} title="Delete conversation" aria-label="Delete conversation" className="opacity-0 group-hover:opacity-100 px-1 text-zinc-400 hover:text-danger-fg">×</button>
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
                {messages.length===0 && !loading && <div className="text-center py-12 text-sm text-muted-foreground">Ask about any concept, lesson, or problem to get started.</div>}
                {messages.map((m,i)=>(
                  <div key={i} className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${m.role==="user"?"bg-primary text-primary-foreground ml-auto":"bg-muted"}`}>{m.content}</div>
                ))}
                {loading && <div className="text-xs text-muted-foreground">Thinking…</div>}
                <div ref={bottomRef} />
              </div>
              <div className="p-3 border-t border-border flex gap-2 items-center">
                <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=> e.key==="Enter" && send()} placeholder="Ask about a concept, lesson, or problem..." aria-label="Ask the tutor" className="flex-1 h-10 rounded-full border border-border bg-card px-4 text-sm focus:outline-none" />
                <Button onClick={send} disabled={loading}>Send</Button>
              </div>
            </div>
          </div>
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
