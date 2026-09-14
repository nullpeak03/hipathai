"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { useState, useRef, useEffect } from "react"
import { Send, Paperclip } from "lucide-react"
import { loadRoadmap, loadGam } from "@/lib/store"

type Msg = { role:"user"|"assistant", content:string }

export default function TutorPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I'm your HiPath AI Mentor + Tutor — I remember your progress. Ask about any concept, lesson, or problem. (Nvidia NIMs fallback: nvidia-only chain)" }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [gam, setGam] = useState({level:3, xp:250, streak:8})
  useEffect(()=> setGam(loadGam() as any), [])
  useEffect(()=> bottomRef.current?.scrollIntoView({behavior:"smooth"}), [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const user: Msg = { role:"user", content: input }
    setMessages(m=> [...m, user])
    setInput("")
    setLoading(true)
    try {
      const roadmap = loadRoadmap()
      // try real NIMs if key exists, else mock
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
        setMessages(m=> [...m, { role:"assistant", content: data.content || data.error || "Mock: Nice streak! For Python, focus on data types and parameters — keep practicing daily." }])
      }
    } catch {
      // fallback mock
      setMessages(m=> [...m, { role:"assistant", content: `You're doing great, maintaining an ${gam.streak}-day learning streak! As a beginner, you're actively building your foundation in Python, focusing on strengthening areas like data types, parameters, and VS Code proficiency. Keep up the consistent effort! (mock fallback — add NVIDIA_NIM_API_KEY to enable real Nvidia NIMs chain)` }])
    } finally { setLoading(false) }
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-zinc-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 flex flex-col max-w-6xl w-full mx-auto p-4 sm:p-6 gap-4">
          <div className="flex gap-4 flex-1 min-h-0">
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 p-4">
                <Button size="sm" className="w-full" onClick={()=>setMessages([{role:"assistant", content:"New chat started. How can I help?"}])}>+ New Chat</Button>
                <div className="mt-4 space-y-2">
                  <div className="p-3 rounded-lg bg-violet-50 dark:bg-zinc-800 text-sm">How am I progressing?<div className="text-xs text-zinc-500">10h ago</div></div>
                </div>
              </div>
            </aside>
            <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 rounded-xl border dark:border-zinc-800 overflow-hidden">
              <div className="p-4 border-b dark:border-zinc-800 flex justify-between items-center">
                <div><div className="font-semibold text-sm">Tutor · I remember past conversations</div><div className="text-xs text-zinc-500">Merged Mentor — persistent memory</div></div>
                <span className="text-xs bg-violet-100 dark:bg-violet-900 px-2 py-1 rounded-full text-violet-700 dark:text-violet-300">Nvidia-only fallback</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m,i)=>(
                  <div key={i} className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${m.role==="user"?"bg-[#6C5BFF] text-white ml-auto":"bg-gray-100 dark:bg-zinc-800"}`}>{m.content}<div className="text-[11px] opacity-60 mt-1">10h ago</div></div>
                ))}
                {loading && <div className="text-xs text-zinc-500">Thinking via NIMs fallback chain...</div>}
                <div ref={bottomRef} />
              </div>
              <div className="p-3 border-t dark:border-zinc-800 flex gap-2 items-center">
                <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"><Paperclip className="w-4 h-4 text-zinc-500" /></button>
                <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=> e.key==="Enter" && send()} placeholder="Ask about a concept, lesson, or problem..." className="flex-1 h-10 rounded-full border px-4 text-sm dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none" />
                <Button onClick={send} disabled={loading}>Send</Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
