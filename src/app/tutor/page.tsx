"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useState, useRef, useEffect } from "react"
import { loadRoadmap, loadRoadmapAsync, loadGam, loadProgress, loadWeakTopics, type WeakTopic } from "@/lib/store"
import type { LessonContent } from "@/lib/lesson-content-blocks"
import { TutorMessageBody } from "@/components/tutor/tutor-message-body"
import { PageTransition } from "@/components/motion/page-transition"
import { EmptyState } from "@/components/ui/empty-state"
import { useSearchParams } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Bot, Image as ImageIcon, Trash2 } from "lucide-react"
import { Suspense } from "react"

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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)

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
      lessonTitle,
      lessonContent,
      recentScores: recentTop3,
      minutesSinceLastStudy,
    }
  }

  const uploadImages = async (files: File[]): Promise<string[]> => {
    const urls: string[] = []
    for (const file of files) {
      try {
        const formData = new FormData()
        // We use the signed-url route: client PUTs directly to Supabase.
        // First request a signed upload URL.
        const res = await fetch("/api/upload/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, contentType: file.type }),
        })
        if (!res.ok) continue
        const { uploadUrl, publicUrl } = (await res.json()) as {
          uploadUrl: string
          publicUrl: string
        }
        // PUT the file directly to Supabase Storage.
        await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        })
        urls.push(publicUrl)
      } catch {
        // skip individual failures
      }
    }
    return urls
  }

  const sendMessage = async (text: string, files: File[] = []) => {
    const content = text.trim()
    if ((!content && files.length === 0) || loading) return
    const userMsg: Msg = { role:"user", content }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput("")
    setSelectedImages([])
    setImageUrls([])
    setLoading(true)
    setUploadNotice(null)
    try {
      // Upload images first, get public URLs
      let uploadedUrls: string[] = []
      if (files.length > 0) {
        uploadedUrls = await uploadImages(files)
        if (uploadedUrls.length < files.length) {
          setUploadNotice("Some images couldn't be uploaded and were skipped. Try again or use a smaller file.")
        }
      }
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
          body: JSON.stringify({ messages: history, context: buildContext(), threadId, images: uploadedUrls }),
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

  const send = () => { void sendMessage(input, selectedImages) }

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
    setSelectedImages([])
    setImageUrls([])
    setUploadNotice(null)
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
                {selectedImages.length > 0 && (
                  <div className="bg-info-bg border border-info-border rounded-lg p-3 mb-2">
                    <div className="text-xs font-semibold text-info-fg mb-2">Attached images</div>
                    <div className="flex gap-2">
                      {selectedImages.map((f, i) => (
                        <div key={i} className="relative group">
                          <img
                            src={URL.createObjectURL(f)}
                            alt="preview"
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                          <button
                            onClick={() => {
                              setSelectedImages(prev => prev.filter((_, idx) => idx !== i))
                              setImageUrls(prev => prev.filter((_, idx) => idx !== i))
                            }}
                            className="absolute -top-1 -right-1 bg-danger-bg text-danger-fg rounded-full w-5 h-5 text-[10px] hover:bg-red-600"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => { setSelectedImages([]); setImageUrls([]) }}
                        className="text-xs text-info-fg underline mt-1"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                )}
                {uploadNotice && <div role="status" aria-live="polite" className="text-xs text-warn-fg bg-warn-bg border border-warn-border rounded-lg px-3 py-2">{uploadNotice}</div>}
                {messages.length===0 && !loading && <EmptyState icon={Bot} title="Start a conversation" description="Ask about any concept, lesson, or problem to get started." />}
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
                  <input
                    value={input}
                    onChange={e=>setInput(e.target.value)}
                    onKeyDown={e=> e.key==="Enter" && send()}
                    placeholder="Ask about a concept, lesson, or problem… (attach an image to ask about code errors)"
                    aria-label="Ask the tutor"
                    className="flex-1 h-11 rounded-full border border-border bg-card px-4 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={e => {
                      const files = Array.from(e.target.files ?? [])
                      setSelectedImages(prev => [...prev, ...files])
                      e.target.value = ""
                    }}
                    className="sr-only"
                  />
                  <button
                    onClick={(e) => { e.preventDefault(); (document.querySelector('input[type="file"]') as HTMLInputElement | null)?.click() }}
                    disabled={loading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
                    aria-label="Attach image"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                </div>
                <Button onClick={send} disabled={loading || (!input.trim() && selectedImages.length === 0)}>
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
