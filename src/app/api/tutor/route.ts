import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { auth } from "@clerk/nextjs/server"

const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY
const NVIDIA_NIM_BASE_URL = process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1"

interface TutorRequest {
  message: string
  roadmapId?: string
  lessonId?: string
  sessionId?: string
  context?: {
    roadmapTitle?: string
    currentPhase?: string
    currentModule?: string
    currentLesson?: string
    concepts?: string[]
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { message, roadmapId, lessonId, sessionId, context }: TutorRequest = body

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_id", userId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    // Get or create chat session
    let chatSessionId = sessionId
    if (!chatSessionId) {
      const { data: newSession, error: sessionError } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: profile.id,
          roadmap_id: roadmapId || null,
          lesson_id: lessonId || null,
          title: message.slice(0, 50) + (message.length > 50 ? "..." : ""),
        })
        .select("id")
        .single()

      if (sessionError) throw sessionError
      chatSessionId = newSession.id
    }

    // Save user message
    await supabase
      .from("chat_messages")
      .insert({
        session_id: chatSessionId,
        role: "user",
        content: message,
      })

    // Get conversation history
    const { data: messages } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", chatSessionId)
      .order("created_at", { ascending: true })
      .limit(20)

    // Build context for AI
    let systemPrompt = `You are HiPath AI Tutor, an expert learning assistant. You help users understand concepts, debug code, explain topics, and guide their learning journey.

Key capabilities:
- Explain complex concepts in simple terms
- Provide code examples and debugging help
- Generate practice exercises
- Adapt explanations to the user's skill level
- Reference the user's current roadmap and lesson context
- Use spaced repetition principles to reinforce learning`

    if (context) {
      systemPrompt += `\n\nCurrent Learning Context:
- Roadmap: ${context.roadmapTitle || "Unknown"}
- Current Phase: ${context.currentPhase || "Unknown"}
- Current Module: ${context.currentModule || "Unknown"}
- Current Lesson: ${context.currentLesson || "Unknown"}
- Key Concepts: ${context.concepts?.join(", ") || "None specified"}`
    }

    // Add learning principles
    systemPrompt += `\n\nTeaching Principles:
1. Ask clarifying questions when needed
2. Break down complex topics into digestible chunks
3. Use analogies and real-world examples
4. Provide practical exercises
5. Encourage active recall and spaced repetition
6. Adapt to the user's pace and style
7. Be encouraging but honest about difficulty`

    // Prepare messages for NIM
    const nimMessages = [
      { role: "system", content: systemPrompt },
      ...(messages || []).map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ]

    // Call NVIDIA NIM
    const response = await fetch(`${NVIDIA_NIM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NVIDIA_NIM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta/llama-3.1-70b-instruct",
        messages: nimMessages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: false,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`NIM API error: ${error}`)
    }

    const result = await response.json()
    const assistantContent = result.choices[0]?.message?.content

    if (!assistantContent) {
      throw new Error("No response from AI")
    }

    // Save assistant message
    await supabase
      .from("chat_messages")
      .insert({
        session_id: chatSessionId,
        role: "assistant",
        content: assistantContent,
      })

    // Update session timestamp
    await supabase
      .from("chat_sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", chatSessionId)

    return NextResponse.json({
      success: true,
      sessionId: chatSessionId,
      message: assistantContent,
    })
  } catch (error) {
    console.error("Tutor error:", error)
    return NextResponse.json(
      { error: "Failed to get tutor response" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")
    const roadmapId = searchParams.get("roadmapId")

    const supabase = await createClient()

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_id", userId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    let query = supabase
      .from("chat_sessions")
      .select(`
        *,
        chat_messages (
          id, role, content, created_at
        )
      `)
      .eq("user_id", profile.id)
      .order("updated_at", { ascending: false })

    if (sessionId) {
      query = query.eq("id", sessionId)
    }

    if (roadmapId) {
      query = query.eq("roadmap_id", roadmapId)
    }

    const { data: sessions, error } = await query.limit(20)

    if (error) throw error

    return NextResponse.json({ sessions: sessions || [] })
  } catch (error) {
    console.error("Get tutor sessions error:", error)
    return NextResponse.json(
      { error: "Failed to fetch tutor sessions" },
      { status: 500 }
    )
  }
}