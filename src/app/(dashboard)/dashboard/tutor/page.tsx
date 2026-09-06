"use client"

import { useEffect, useRef, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Copy, 
  Check,
  Sparkles,
  BookOpen,
  Code,
  Lightbulb,
  Bug,
  Trash2,
  Plus,
  MessageSquare,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Markdown } from "@/components/markdown"

interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  created_at: string
  tool_calls?: any[]
  metadata?: any
}

interface ChatSession {
  id: string
  title: string
  roadmap_id?: string
  lesson_id?: string
  created_at: string
  messages: Message[]
}

interface Roadmap {
  id: string
  title: string
  roadmap_phases: Array<{
    id: string
    title: string
    roadmap_modules: Array<{
      id: string
      title: string
      lessons: Array<{ id: string; title: string }>
    }>
  }>
}

function TutorPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([])
  const [selectedContext, setSelectedContext] = useState<{
    roadmapId?: string
    lessonId?: string
  }>({})

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetchSessions()
    fetchRoadmaps()
  }, [])

  useEffect(() => {
    const sessionId = searchParams.get("session")
    if (sessionId && sessions.length > 0) {
      const session = sessions.find(s => s.id === sessionId)
      if (session) {
        setCurrentSession(session)
        setMessages(session.messages)
      }
    }
  }, [searchParams, sessions])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isStreaming])

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select(`
          id,
          title,
          roadmap_id,
          lesson_id,
          created_at,
          messages (id, role, content, created_at, tool_calls, metadata)
        `)
        .order("created_at", { ascending: false })
        .limit(20)

      if (error) throw error
      setSessions(data || [])
    } catch (error) {
      console.error("Failed to fetch sessions:", error)
    }
  }

  const fetchRoadmaps = async () => {
    try {
      const { data, error } = await supabase
        .from("roadmaps")
        .select(`
          id,
          title,
          roadmap_phases (
            id,
            title,
            roadmap_modules (
              id,
              title,
              lessons (id, title)
            )
          )
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false })

      if (error) throw error
      setRoadmaps(data || [])
    } catch (error) {
      console.error("Failed to fetch roadmaps:", error)
    }
  }

  const createNewSession = async () => {
    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({
          title: "New Chat",
          roadmap_id: selectedContext.roadmapId,
          lesson_id: selectedContext.lessonId,
        })
        .select()
        .single()

      if (error) throw error
      
      const newSession: ChatSession = {
        ...data,
        messages: [],
      }
      
      setSessions(prev => [newSession, ...prev])
      setCurrentSession(newSession)
      setMessages([])
      router.push(`/dashboard/tutor?session=${data.id}`)
    } catch (error) {
      console.error("Failed to create session:", error)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !currentSession) return

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: input,
      created_at: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    setIsStreaming(true)

    try {
      const response = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSession.id,
          message: userMessage.content,
          context: selectedContext,
        }),
      })

      if (!response.ok) throw new Error("Failed to send message")

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ""
      let assistantMessageId = `temp-${Date.now()}`

      // Add placeholder assistant message
      setMessages(prev => [...prev, {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      }])

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split("\n")
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") continue
            
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                assistantContent += parsed.content
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: assistantContent }
                    : msg
                ))
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      // Update session in sidebar
      setSessions(prev => prev.map(s => 
        s.id === currentSession.id 
          ? { ...s, messages: [...s.messages, userMessage, { 
              id: assistantMessageId, 
              role: "assistant" as const, 
              content: assistantContent, 
              created_at: new Date().toISOString() 
            }] }
          : s
      ))

    } catch (error) {
      console.error("Failed to send message:", error)
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        created_at: new Date().toISOString(),
      }])
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const deleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from("chat_sessions")
        .delete()
        .eq("id", sessionId)

      if (error) throw error
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (currentSession?.id === sessionId) {
        setCurrentSession(null)
        setMessages([])
        router.push("/dashboard/tutor")
      }
    } catch (error) {
      console.error("Failed to delete session:", error)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const quickPrompts = [
    { label: "Explain this concept", icon: BookOpen, prompt: "Can you explain this concept in simple terms?" },
    { label: "Give me a practice problem", icon: Code, prompt: "Generate a practice problem for me to solve." },
    { label: "Create an analogy", icon: Lightbulb, prompt: "Create an analogy to help me understand this better." },
    { label: "Debug my code", icon: Bug, prompt: "Help me debug this code:" },
  ]

  return (
    <div className="flex h-[calc(100vh-5rem)] min-h-[620px] overflow-hidden rounded-3xl border border-white/10 bg-[#080d1c] shadow-2xl shadow-black/20">
      {/* Sidebar */}
      <aside className={`${showSidebar ? "w-80" : "w-16"} flex shrink-0 flex-col border-r border-white/10 bg-[#101828]/75 transition-all duration-200`}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold" style={{ display: showSidebar ? "block" : "none" }}>
            AI Tutor
          </h2>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowSidebar(!showSidebar)}
            className="ml-auto"
          >
            {showSidebar ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        <div className="p-3 border-b" style={{ display: showSidebar ? "block" : "none" }}>
          <Button 
            onClick={createNewSession} 
            className="w-full justify-start gap-2"
            disabled={isLoading}
          >
            <Plus className="h-4 w-4" />
            <span>New Chat</span>
          </Button>
        </div>

        {/* Context Selector */}
        <div className="p-3 border-b" style={{ display: showSidebar ? "block" : "none" }}>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Context</label>
            <div className="space-y-1">
              <select
                value={selectedContext.roadmapId || ""}
                onChange={(e) => setSelectedContext(prev => ({ ...prev, roadmapId: e.target.value || undefined }))}
                className="w-full text-sm px-2 py-1.5 border rounded bg-background"
              >
                <option value="">No roadmap selected</option>
                {roadmaps.map(r => (
                  <option key={r.id} value={r.id}>{r.title}</option>
                ))}
              </select>
              {selectedContext.roadmapId && (
                <select
                  value={selectedContext.lessonId || ""}
                  onChange={(e) => setSelectedContext(prev => ({ ...prev, lessonId: e.target.value || undefined }))}
                  className="w-full text-sm px-2 py-1.5 border rounded bg-background"
                >
                  <option value="">No specific lesson</option>
                  {roadmaps.find(r => r.id === selectedContext.roadmapId)?.roadmap_phases.flatMap(p => 
                    p.roadmap_modules.flatMap(m => m.lessons)
                  ).map(l => (
                    <option key={l.id} value={l.id}>{l.title}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Sessions List */}
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            {sessions.map(session => (
              <div
                key={session.id}
                className={`relative group p-2 rounded-lg transition-colors ${
                  currentSession?.id === session.id
                    ? "bg-primary/10"
                    : "hover:bg-muted/50"
                }`}
              >
                <button
                  onClick={() => {
                    setCurrentSession(session)
                    setMessages(session.messages)
                    router.push(`/dashboard/tutor?session=${session.id}`)
                  }}
                  className="w-full text-left flex items-start gap-2"
                >
                  <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0" style={{ display: showSidebar ? "block" : "none" }}>
                    <p className="text-sm font-medium truncate">{session.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => { e.stopPropagation(); deleteSession(session.id) }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ display: showSidebar ? "block" : "none" }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground" style={{ display: showSidebar ? "block" : "none" }}>
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No chats yet</p>
                <p className="text-xs">Start a new conversation</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#101828]/70 backdrop-blur-2xl">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-400/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold">HiPath AI Tutor</h1>
                <p className="text-xs text-muted-foreground">
                  {currentSession?.title || "Start a new conversation"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2" style={{ display: showSidebar ? "flex" : "none" }}>
              {selectedContext.roadmapId && (
                <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                  Context: {roadmaps.find(r => r.id === selectedContext.roadmapId)?.title}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4 space-y-6">
          {messages.length === 0 && !currentSession && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Welcome to your AI Tutor</h2>
              <p className="text-muted-foreground max-w-md mb-6">
                I'm here to help you learn! Ask me anything about your current lesson, 
                get explanations, practice problems, or debugging help.
              </p>
              <div className="flex flex-wrap gap-2 justify-center" style={{ display: showSidebar ? "flex" : "none" }}>
                {quickPrompts.map((qp, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setInput(qp.prompt)
                      textareaRef.current?.focus()
                    }}
                    className="gap-1"
                  >
                    <qp.icon className="h-3.5 w-3.5" />
                    {qp.label}
                  </Button>
                ))}
              </div>
              <Button 
                onClick={createNewSession} 
                className="mt-4 gap-2"
                size="lg"
              >
                <Plus className="h-4 w-4" />
                Start New Chat
              </Button>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
              <div 
                className={`flex-1 max-w-[80%] ${message.role === "user" ? "text-right" : ""}`}
              >
                <div className={`inline-block px-4 py-2 rounded-2xl ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted rounded-tl-sm"
                }`}>
                  <Markdown content={message.content} />
                  
                  {message.tool_calls && message.tool_calls.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {message.tool_calls.map((tool: any, i: number) => (
                        <div key={i} className="text-xs text-muted-foreground/80 font-mono">
                          🔧 {tool.function?.name}({tool.function?.arguments})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-1" style={{ justifyContent: message.role === "user" ? "flex-end" : "flex-start" }}>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                  </span>
                  {message.role === "assistant" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(message.content)}
                      className="h-6 w-6"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2 max-w-[80%]">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Quick Actions (when no messages) */}
        {messages.length === 0 && currentSession && (
          <div className="p-4 border-t bg-card/50" style={{ display: showSidebar ? "block" : "none" }}>
            <p className="text-sm text-muted-foreground mb-3">Quick actions:</p>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((qp, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setInput(qp.prompt)
                    textareaRef.current?.focus()
                  }}
                  className="gap-1"
                >
                  <qp.icon className="h-3.5 w-3.5" />
                  {qp.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-white/10 bg-[#101828]/70 p-4 backdrop-blur-2xl">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about your learning..."
              className="flex-1 min-h-[44px] max-h-[200px] resize-none px-4 py-3 rounded-xl border bg-background"
              rows={1}
              disabled={isLoading}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              size="lg"
              className="h-[44px] rounded-xl"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </main>
    </div>
  )
}

export default function TutorPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <TutorPageContent />
    </Suspense>
  )
}