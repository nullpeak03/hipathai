import { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { chatForFeature, type ChatMessage } from "@/lib/ai-router"
import { getErrorMessage } from "@/lib/utils"
import { createServerClient } from "@/lib/supabase/server"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { parseTutorContent, flattenLessonContent, TUTOR_JSON_CONTRACT, type LessonContent } from "@/lib/lesson-content-blocks"

// Edge for streaming
export const runtime = "nodejs"

export type TutorContext = {
  roadmapTitle?: string
  roadmapPhases?: { title: string; lessons: string[] }[]
  level?: number
  xp?: number
  streak?: number
  lessonsDone?: number
  totalLessons?: number
  weakTopics?: string[]
  lessonTitle?: string
  lessonContent?: string
}

function buildSystemPrompt(context?: TutorContext): string {
  const weak = context?.weakTopics?.length
    ? `Known weak areas: ${context.weakTopics.join(", ")}. Proactively suggest practice for these.`
    : "No weak areas tracked yet."
  const progress = context?.totalLessons
    ? `Progress: ${context.lessonsDone ?? 0}/${context.totalLessons} lessons on "${context.roadmapTitle}".`
    : `Roadmap: ${context?.roadmapTitle || "No roadmap yet"}.`
  const roadmapDetail = context?.roadmapPhases?.length
    ? ` Roadmap structure: ${context.roadmapPhases.map((p) => `${p.title} (${p.lessons.join(", ")})`).join(" | ")}.`
    : ""
  const lessonDetail = context?.lessonTitle
    ? ` Current lesson: "${context.lessonTitle}"${context.lessonContent ? ` — Content: ${context.lessonContent.slice(0, 1500)}` : ""}. You MUST reference this lesson by name and content when answering; do not give generic reasoning.`
    : ""
  return `You are HiPath AI Mentor + Tutor (merged). Persistent AI mentor for Computer Science & Technology. ${progress}${roadmapDetail}${lessonDetail} Level ${context?.level ?? 1}, ${context?.xp ?? 0} XP, ${context?.streak ?? 0}-day streak. ${weak} Be motivational and adapt explanations to the learner's level. Answer thoroughly: explain the concept fully with a concrete runnable example, add one tip or common mistake, and close with a quick check question — never one-liners. When a lesson is provided, ground your answer in it. ${TUTOR_JSON_CONTRACT}`
}

/** Persist the latest exchange to a caller-owned thread (best-effort). */
async function persistExchange(threadId: string, userId: string, userContent: string, assistantContent: string, modelUsed: string, blocks: LessonContent | null) {
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
      { thread_id: threadId, role: "assistant", content: assistantContent, meta: { model: modelUsed, blocks } },
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

    const { userId: chatUser } = await auth()
    const rl = await checkRateLimit(
      `rl:${chatUser ?? req.headers.get("x-forwarded-for") ?? "anon"}:tutor`,
      RATE_LIMITS.tutor.limit,
      RATE_LIMITS.tutor.windowMs
    )
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "Too many chat requests. Please wait a bit and try again." }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      })
    }

    let content = ""
    let blocks: LessonContent | null = null
    let modelUsed = "mock"

    // try the tutor NIM model pool (primary + same-provider fallback), else mock — always structured
    if (process.env.NVIDIA_NIM_API_KEY) {
      try {
        const res = await chatForFeature("tutor", all, { jsonMode: true, maxTokens: 3500 })
        const parsed = parseTutorContent(res.content)
        blocks = parsed
        content = parsed ? flattenLessonContent(parsed) : res.content.trim().slice(0, 4000)
        modelUsed = res.modelUsed
      } catch (e) {
        const message = getErrorMessage(e)
        // fallback to mock if the model fails
        if (!message.includes("MISSING") && !message.includes("FAILED")) throw e
      }
    }
    if (!content) {
      // neutral fallback if NIMs not configured / unavailable — wrap as paragraph block
      const fallbackText = /progress/i.test(lastUser)
        ? `You're at Lv.${context?.level ?? 1} with ${context?.xp ?? 0} XP and a ${context?.streak ?? 0}-day streak. Keep up the daily practice to build momentum!`
        : `Thanks for your message: "${lastUser.slice(0, 120)}". I'm your HiPath mentor — tell me your goal and I'll guide you step by step.`
      content = fallbackText
      blocks = { sections: [{ type: "paragraph", text: fallbackText }] }
      modelUsed = "mock"
    } else if (!blocks) {
      blocks = parseTutorContent(content)
      if (!blocks) blocks = { sections: [{ type: "paragraph", text: content.slice(0, 2000) }] }
      else content = flattenLessonContent(blocks)
    }

    if (threadId && lastUser) {
      const { userId } = await auth()
      if (userId) {
        await persistExchange(threadId, userId, lastUser, content, modelUsed, blocks)
      }
    }

    return new Response(JSON.stringify({ content, blocks, modelUsed, threadId: threadId ?? null }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: getErrorMessage(e) }), { status: 500 })
  }
}
