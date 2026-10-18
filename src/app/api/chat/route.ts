import { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { chatForFeature, type ChatMessage } from "@/lib/ai-router"
import { callNimStream } from "@/lib/nim"
import { getErrorMessage } from "@/lib/utils"
import { createServerClient } from "@/lib/supabase/server"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { parseTutorContent, flattenLessonContent, looksLikeJson, tutorQualityScore, type LessonContent } from "@/lib/lesson-content-blocks"
import { buildSystemPrompt, type TutorContext } from "@/lib/tutor-prompt"

// Edge for streaming
export const runtime = "nodejs"

/** Generate tutor response using NIM models with quality gate and fallback. */
async function generateTutorResponse(
  all: ChatMessage[],
  lastUser: string,
  feature: "tutor" | "vision",
  model: string,
  maxTokens: number,
  timeoutMs: number
): Promise<{ content: string; blocks: LessonContent | null; modelUsed: string; unusable: boolean }> {
  let content = ""
  let blocks: LessonContent | null = null
  let modelUsed = "mock"
  let unusable = false

  try {
    const res = await chatForFeature(feature, all, {
      jsonMode: true,
      maxTokens,
      timeoutMs,
      retries: 0,
    })
    modelUsed = res.modelUsed
    const parsed = parseTutorContent(res.content)
    if (parsed) {
      blocks = parsed
      content = flattenLessonContent(parsed)
      // Quality gate: regenerate once if score < 60
      const quality = tutorQualityScore(parsed)
      console.log(`[chat] Tutor response quality: ${quality}/100`)
      if (quality < 60) {
        console.warn(`[chat] Quality ${quality} < 60, regenerating once`)
        const retry = await chatForFeature(feature, [
          ...all,
          { role: "user", content: `Your previous reply scored low on quality. Ensure: code block if relevant, check question, callout, heading+paragraph structure. Question: ${lastUser.slice(0, 500)}` },
        ], { jsonMode: true, maxTokens: 3500, timeoutMs: 15000, retries: 0 })
        const parsed2 = parseTutorContent(retry.content)
        if (parsed2 && tutorQualityScore(parsed2) > quality) {
          blocks = parsed2
          content = flattenLessonContent(parsed2)
          modelUsed = retry.modelUsed
          console.log(`[chat] Regenerated quality: ${tutorQualityScore(parsed2)}`)
        }
      }
    } else if (!looksLikeJson(res.content) && res.content.trim().length > 0) {
      content = res.content.trim().slice(0, 4000)
      blocks = { sections: [{ type: "paragraph", text: content.slice(0, 2000) }] }
    } else {
      const elapsed = 0 // t0 not available here, but not critical for this path
      if (true) { // always attempt retry for unusable JSON
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
        unusable = true
      }
    }
  } catch (e: unknown) {
    const message = getErrorMessage(e)
    if (!message.includes("MISSING") && !message.includes("FAILED")) throw e
  }

  if (!content) {
    if (unusable) {
      return { content: "", blocks: null, modelUsed: "mock", unusable: true }
    }
    const fallbackText = /progress/i.test(lastUser)
      ? `You're at Lv.${0} with ${0} XP and a ${0}-day streak. Keep up the daily practice to build momentum!`
      : `Thanks for your message: "${lastUser.slice(0, 120)}". I'm your HiPath mentor — tell me your goal and I'll guide you step by step.`
    content = fallbackText
    blocks = { sections: [{ type: "paragraph", text: fallbackText }] }
    modelUsed = "mock"
  }

  return { content, blocks, modelUsed, unusable }
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

/** Streaming response handler — yields SSE chunks for real-time feel. */
async function handleStream(req: NextRequest): Promise<Response> {
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

  const feature: "tutor" | "vision" = hasImages ? "vision" : "tutor"
  const model = feature === "vision"
    ? process.env.NIM_VISION_MODEL || "nvidia/nemotron-3.5-super-vl"
    : process.env.NIM_TUTOR_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b"
  const maxTokens = hasImages ? 4000 : 3500
  const timeoutMs = hasImages ? 28000 : 25000

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = ""
      let modelUsed = "mock"
      let blocks: LessonContent | null = null
      let error: string | null = null

      try {
        if (process.env.NVIDIA_NIM_API_KEY) {
          for await (const chunk of callNimStream({
            model,
            messages: all,
            jsonMode: true,
            maxTokens,
            timeoutMs,
            thinkingDisabled: true,
            stream: true,
          })) {
            fullContent += chunk
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk })}\n\n`))
          }
          modelUsed = `nim/${model}`
          const parsed = parseTutorContent(fullContent)
          if (parsed) {
            blocks = parsed
            // Quality gate: regenerate once if score < 60
            const quality = tutorQualityScore(parsed)
            console.log(`[chat stream] Tutor response quality: ${quality}/100`)
            if (quality < 60) {
              console.warn(`[chat stream] Quality ${quality} < 60, regenerating once`)
              const retryContent = await chatForFeature(feature, [
                ...all,
                { role: "user", content: `Your previous reply scored low on quality. Ensure: code block if relevant, check question, callout, heading+paragraph structure. Question: ${lastUser.slice(0, 500)}` },
              ], { jsonMode: true, maxTokens, timeoutMs: 15000, retries: 0 })
              const parsed2 = parseTutorContent(retryContent.content)
              if (parsed2 && tutorQualityScore(parsed2) > quality) {
                blocks = parsed2
                fullContent = flattenLessonContent(parsed2)
                console.log(`[chat stream] Regenerated quality: ${tutorQualityScore(parsed2)}`)
              }
            }
          } else if (!looksLikeJson(fullContent) && fullContent.trim().length > 0) {
            blocks = { sections: [{ type: "paragraph", text: fullContent.trim().slice(0, 2000) }] }
          } else {
            // JSON-shaped but unusable — try one strict retry
            const retryContent = await chatForFeature(feature, [
              ...all,
              { role: "user", content: `Your previous reply was malformed. Answer again with at least one full paragraph section: {"sections":[{"type":"paragraph","text":"..."}]}. Question: ${lastUser.slice(0, 500)}` },
            ], { jsonMode: true, maxTokens, timeoutMs: 15000, retries: 0 })
            const parsed2 = parseTutorContent(retryContent.content)
            if (parsed2) {
              blocks = parsed2
              fullContent = flattenLessonContent(parsed2)
}
}
      } catch (e) {

      if (!fullContent || error) {
        // Fallback to mock
        const fallbackText = /progress/i.test(lastUser)
          ? `You're at Lv.${context?.level ?? 1} with ${context?.xp ?? 0} XP and a ${context?.streak ?? 0}-day streak. Keep up the daily practice to build momentum!`
          : `Thanks for your message: "${lastUser.slice(0, 120)}". I'm your HiPath mentor — tell me your goal and I'll guide you step by step.`
        fullContent = fallbackText
        blocks = { sections: [{ type: "paragraph", text: fallbackText }] }
        modelUsed = "mock"
      }

      // Persist the full exchange
      if (threadId && lastUser) {
        const { userId } = await auth()
        if (userId) {
          await persistExchange(threadId, userId, lastUser, fullContent, modelUsed, blocks)
        }
      }

      // Send final message with blocks and metadata
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, content: fullContent, blocks, modelUsed, threadId: threadId ?? null })}\n\n`))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}

export async function POST(req: NextRequest) {
  // Check if client wants streaming (via Accept header or query param)
  const wantsStream = req.headers.get("accept")?.includes("text/event-stream") ||
    req.nextUrl.searchParams.get("stream") === "1"
  if (wantsStream) {
    return handleStream(req)
  }
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

const feature: "tutor" | "vision" = hasImages ? "vision" : "tutor"
    const model = feature === "vision"
      ? process.env.NIM_VISION_MODEL || "nvidia/nemotron-3.5-super-vl"
      : process.env.NIM_TUTOR_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b"
    const maxTokens = hasImages ? 4000 : 3500
    const timeoutMs = hasImages ? 28000 : 25000

    const { content, blocks, modelUsed, unusable } = await generateTutorResponse(
      all, lastUser, feature, model, maxTokens, timeoutMs
    )

    if (!content && unusable) {
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
  } catch (e: unknown) {
    // Never leak raw provider text (HTTP 503 dumps, timeouts) to the client.
    return new Response(
      JSON.stringify({ error: "The AI is taking too long right now. Please try again in a moment." }),
      { status: 500 }
    )
  }
}