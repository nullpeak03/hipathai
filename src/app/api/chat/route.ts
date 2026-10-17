import { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { chatForFeature, type ChatMessage } from "@/lib/ai-router"
import { getErrorMessage } from "@/lib/utils"
import { createServerClient } from "@/lib/supabase/server"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { parseTutorContent, flattenLessonContent, looksLikeJson, type LessonContent } from "@/lib/lesson-content-blocks"
import { buildSystemPrompt, type TutorContext } from "@/lib/tutor-prompt"

// Edge for streaming
export const runtime = "nodejs"

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
    const { messages, context, threadId, images } = (await req.json()) as {
      messages?: { role: "user" | "assistant"; content: string }[]
      context?: TutorContext
      threadId?: string
      images?: string[]
    }
    const sys = buildSystemPrompt(context)
    const all: ChatMessage[] = [{ role: "system", content: sys }, ...((messages || []) as ChatMessage[])]
    const lastUser = [...(messages || [])].reverse().find((m) => m.role === "user")?.content || ""

    // If images are attached, append them as image_url parts to the last user
    // message and route through the vision model (Nemotron 3.5 Super VL).
    const hasImages = Array.isArray(images) && images.length > 0
    if (hasImages) {
      const lastUserIdx = all.findLastIndex((m) => m.role === "user")
      if (lastUserIdx >= 0) {
        const existing = all[lastUserIdx]!.content
        const parts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> =
          typeof existing === "string" ? [{ type: "text", text: existing }] : existing
        images.forEach((url) => parts.push({ type: "image_url", image_url: { url } }))
        all[lastUserIdx]!.content = parts
      }
    }

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
    let unusable = false

    // try the tutor/vision NIM model pool (primary + same-provider fallback), else mock
    if (process.env.NVIDIA_NIM_API_KEY) {
      try {
        // Bounded for the 60s route cap: ONE attempt (worst ~50s with
        // fallback), no in-function retries. Vision calls can be slower due
        // to image processing, so we give a slightly larger budget.
        const t0 = Date.now()
        const feature: "tutor" | "vision" = hasImages ? "vision" : "tutor"
        const res = await chatForFeature(feature, all, {
          jsonMode: true,
          maxTokens: hasImages ? 4000 : 3500,
          timeoutMs: hasImages ? 28000 : 25000,
          retries: 0,
        })
        modelUsed = res.modelUsed
        const parsed = parseTutorContent(res.content)
        if (parsed) {
          blocks = parsed
          content = flattenLessonContent(parsed)
        } else if (!looksLikeJson(res.content) && res.content.trim().length > 0) {
          // Genuine prose (lenient path): wrap it for display.
          content = res.content.trim().slice(0, 4000)
          blocks = { sections: [{ type: "paragraph", text: content.slice(0, 2000) }] }
        } else {
          // JSON-shaped but unusable: one stricter retry inside the budget
          const elapsed = Date.now() - t0
          if (elapsed < 20000) {
            console.warn("[chat] tutor reply unparseable, retrying once with strict shape")
            const retry = await chatForFeature(feature, [
              ...all,
              { role: "user", content: `Your previous reply was malformed. Answer again with at least one full paragraph section: {"sections":[{"type":"paragraph","text":"..."}]}. Question: ${lastUser.slice(0, 500)}` },
            ], { jsonMode: true, maxTokens: 3500, timeoutMs: 15000, retries: 0 })
            const parsed2 = parseTutorContent(retry.content)
            if (parsed2) {
              blocks = parsed2
              content = flattenLessonContent(parsed2)
              modelUsed = retry.modelUsed
            } else {
              unusable = true
            }
          } else {
            console.warn(`[chat] tutor reply unparseable and budget spent (${elapsed}ms), asking user to retry`)
            unusable = true
          }
        }
      } catch (e) {
        const message = getErrorMessage(e)
        // fallback to mock if the model fails
        if (!message.includes("MISSING") && !message.includes("FAILED")) throw e
      }
    }
    if (!content) {
      if (unusable) {
        // Model reached but produced nothing displayable twice — ask for a
        // retry conversationally (renders as an assistant message). Skip
        // persistence: there is nothing worth remembering.
        return new Response(JSON.stringify({
          error: "I couldn't put together a good answer just now — please ask again.",
          threadId: threadId ?? null,
        }), { headers: { "Content-Type": "application/json" } })
      }
      // neutral fallback if NIMs not configured / unavailable — wrap as paragraph block
      const fallbackText = /progress/i.test(lastUser)
        ? `You're at Lv.${context?.level ?? 1} with ${context?.xp ?? 0} XP and a ${context?.streak ?? 0}-day streak. Keep up the daily practice to build momentum!`
        : `Thanks for your message: "${lastUser.slice(0, 120)}". I'm your HiPath mentor — tell me your goal and I'll guide you step by step.`
      content = fallbackText
      blocks = { sections: [{ type: "paragraph", text: fallbackText }] }
      modelUsed = "mock"
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
  } catch {
    // Never leak raw provider text (HTTP 503 dumps, timeouts) to the client.
    return new Response(
      JSON.stringify({ error: "The AI is taking too long right now. Please try again in a moment." }),
      { status: 500 }
    )
  }
}
