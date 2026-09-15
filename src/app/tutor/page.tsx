"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { useState, useRef, useEffect } from "react"
import { Send, Paperclip } from "lucide-react"
import { loadRoadmap, loadGam } from "@/lib/store"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

type Msg = { role:"user"|"assistant", content:string }

function TutorContent() {
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [gam, setGam] = useState({level:1, xp:0, streak:0})
  useEffect(()=> {
    setGam(loadGam() as any)
    // check for prefill from dashboard ?q= or localStorage
    const q = searchParams.get("q") || (()=>{ try { const v=localStorage.getItem("hipath_tutor_prefill"); if(v){ localStorage.removeItem("hipath_tutor_prefill"); return v } } catch{}; return null })()
    if (q) {
      setInput(q)
      // auto-send after a tick so user sees it
      setTimeout(()=> {
        const user: Msg = { role:"user", content: q }
        setMessages(m=> [...m, user])
        setInput("")
        // trigger send programmatically
        ;(async () => {
          // we need to set loading and call api, but we can reuse send logic by inlining
          // for now just set input and let user press send, or auto-send via direct fetch
          try {
            const roadmap = loadRoadmap()
            const gamNow = loadGam() as any
            const res = await fetch("/api/chat", {
              method:"POST",
              headers:{"Content-Type":"application/json"},
              body: JSON.stringify({ messages: [{ role:"user", content: q }], context: { roadmapTitle: roadmap?.title, level: gamNow.level, xp: gamNow.xp, streak: gamNow.streak } })
            })
            if (res.ok) {
              const data = await res.json()
              setMessages(m=> [...m, { role:"assistant", content: data.content || "I couldn't generate a response." }])
            }
          } catch {}
        })()
      }, 300)
    } else {
      setMessages([])
    }
  }, [searchParams])

  const send = async () => {
    if (!input.trim() || loading) return
    const user: Msg = { role:"user", content: input }
    setMessages(m=> [...m, user])
    setInput("")
    setLoading(true)
    try {
      const roadmap = loadRoadmap()
      const res = await fetch("/api/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ messages: [...messages, user], context: { roadmapTitle: roadmap?.title, level: gam.level, xp: gam.xp, streak: gam.streak } })
      })
      if (!res.ok) throw new Error("api fail")
      if (res.headers.get("content-type")?.includes("text/event-stream")) {
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let assistant = ""
        setMessages(m=> [...m, { role:"assistant", content:"" }])
        while(true){
          const {done, value} = await reader.read()
          if(done) break
          const chunk = decoder.decode(value)
          assistant+=chunk
          setMessages(m=> { const copy=[...m]; copy[copy.length-1]={role:"assistant", content: assistant}; return copy })
        }
      } else {
        const data = await res.json()
        setMessages(m=> [...m, { role:"assistant", content: data.content || data.error || "I couldn't generate a response. Please try again." }])
      }
    } catch {
      setMessages(m=> [...m, { role:"assistant", content: `I couldn't reach the AI. Please check your connection and try again. (Nvidia NIMs nvidia-only chain)` }])
    } finally { setLoading(false) }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 flex flex-col max-w-6xl w-full mx-auto p-4 sm:p-6 gap-4">
          <div className="flex gap-4 flex-1 min-h-0">
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="bg-white rounded-xl border p-4">
                <Button size="sm" className="w-full" onClick={()=>setMessages([])}>+ New Chat</Button>
                <div className="mt-4 text-xs text-zinc-500 text-center py-8">{messages.length===0 ? "No conversations yet. Start by asking a question." : `${messages.length} messages`}</div>
              </div>
            </aside>
            <div className="flex-1 flex flex-col bg-white rounded-xl border overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center">
                <div><div className="font-semibold text-sm">Tutor · Persistent memory</div><div className="text-xs text-zinc-500">Your AI mentor remembers your progress</div></div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length===0 && !loading && <div className="text-center py-12 text-sm text-zinc-500">Ask about any concept, lesson, or problem to get started.</div>}
                {messages.map((m,i)=>(
                  <div key={i} className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${m.role==="user"?"bg-[#6C5BFF] text-white ml-auto":"bg-gray-100"}`}>{m.content}</div>
                ))}
                {loading && <div className="text-xs text-zinc-500">Thinking…</div>}
                <div ref={bottomRef} />
              </div>
              <div className="p-3 border-t flex gap-2 items-center">
                <button className="p-2 rounded-full hover:bg-gray-100" title="Attach file (coming soon)"><Paperclip className="w-4 h-4 text-zinc-500" /></button>
                <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=> e.key==="Enter" && send()} placeholder="Ask about a concept, lesson, or problem..." className="flex-1 h-10 rounded-full border px-4 text-sm focus:outline-none" />
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
    <Suspense fallback={<div className="flex min-h-screen bg-gray-50"><div className="flex-1 p-8"><div className="animate-pulse h-8 bg-gray-200 rounded w-1/3"/></div></div>}>
      <TutorContent />
    </Suspense>
  )
}
