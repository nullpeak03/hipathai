import { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { chatWithFallback, type ChatMessage } from "@/lib/nvidia"
import { getErrorMessage } from "@/lib/utils"
import { createServerClient } from "@/lib/supabase/server"

// Edge for streaming
export const runtime = "nodejs"

export type TutorContext = {
  roadmapTitle?: string
  level?: number
  xp?: number
  streak?: number
  lessonsDone?: number
  totalLessons?: number
  weakTopics?: string[]
}

function buildSystemPrompt(context?: TutorContext): string {
  const weak = context?.weakTopics?.length
    ? `Known weak areas: ${context.weakTopics.join(", ")}. Proactively suggest practice for these.`
    : "No weak areas tracked yet."
  const progress = context?.totalLessons
    ? `Progress: ${context.lessonsDone ?? 0}/${context.totalLessons} lessons on "${context.roadmapTitle}".`
    : `Roadmap: ${context?.roadmapTitle || "No roadmap yet"}.`
  return `You are HiPath AI Mentor + Tutor (merged). Persistent AI mentor for Computer Science & Technology. ${progress} Level ${context?.level ?? 1}, ${context?.xp ?? 0} XP, ${context?.streak ?? 0}-day streak. ${weak} Be concise, motivational, adapt explanations to the learner's level.`
}

/** Persist the latest exchange to a caller-owned thread (best-effort). */
async function persistExchange(threadId: string, userId: string, userContent: string, assistantContent: string, modelUsed: string) {
  try {
    const supabase = createServerClient()
    const { data: thread } = await supabase
      .from("chat_threads")
      .select("user_id,title")
      .eq("id", threadId)
      .single()
    if (!thread || (thread as { user_id: string }).user_id !== userId) return
    const { count } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", threadId)
    await supabase.from("chat_messages").insert([
      { thread_id: threadId, role: "user", content: userContent },
      { thread_id: threadId, role: "assistant", content: assistantContent, meta: { model: modelUsed } },
    ])
    // Title untitled threads from their first question
    if ((count ?? 0) === 0 && userContent.trim().length > 0) {
      await supabase
        .from("chat_threads")
        .update({ title: userContent.slice(0, 60) })
        .eq("id", threadId)
    }
  } catch (e) {
    console.warn("[chat] persist failed:", getErrorMessage(e))
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, context, threadId } = (await req.json()) as {
      messages?: { role: "user" | "assistant"; content: string }[]
      context?: TutorContext
      threadId?: string
    }
    const sys = buildSystemPrompt(context)
    const all: ChatMessage[] = [{ role: "system", content: sys }, ...((messages || []) as ChatMessage[])]
    const lastUser = [...(messages || [])].reverse().find((m) => m.role === "user")?.content || ""

    let content = ""
    let modelUsed = "mock"

    // try real NIMs if key set (support all env variants)
    if (process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY || process.env.NIM_API_KEY) {
      try {
        const res = await chatWithFallback(all)
        content = res.content
        modelUsed = res.modelUsed
      } catch (e) {
        const message = getErrorMessage(e)
        // fallback to mock if all models fail
        if (!message.includes("MISSING") && !message.includes("FAILED")) throw e
      }
    }
    if (!content) {
      // neutral fallback if NIMs not configured / unavailable
      content = `Thanks for your message: "${lastUser.slice(0, 120)}". I'm your HiPath mentor — tell me your goal and I'll guide you step by step.`
      modelUsed = "mock"
      if (/progress/i.test(lastUser)) {
        content = `You're at Lv.${context?.level ?? 1} with ${context?.xp ?? 0} XP and a ${context?.streak ?? 0}-day streak. Keep up the daily practice to build momentum!`
      }
    }

    if (threadId && lastUser) {
      const { userId } = await auth()
      if (userId) {
        await persistExchange(threadId, userId, lastUser, content, modelUsed)
      }
    }

    return new Response(JSON.stringify({ content, modelUsed, threadId: threadId ?? null }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: getErrorMessage(e) }), { status: 500 })
  }
}
