import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { chatForFeature } from "@/lib/ai-router"
import { getErrorMessage } from "@/lib/utils"
import { buildRoadmapPrompt } from "@/lib/roadmap-prompt"
import { normalizeRoadmapJson } from "@/lib/roadmap-normalize"
import { planRoadmapSize } from "@/lib/roadmap-sizing"
import { validateRoadmapInput } from "@/lib/roadmap-input"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
  // NOTE: best-effort sync endpoint with a ~50s worst-case budget (one
  // attempt, 25s call cap). Full roadmaps often take longer — prefer POST
  // /api/roadmaps/async (Inngest + polling).
  console.warn("[roadmaps/sync] sync generation requested (prefer /async for reliability)")
  const { userId } = await auth()
  const rlKey = `rl:${userId ?? req.headers.get("x-forwarded-for") ?? "anon"}:roadmap`
  const rl = await checkRateLimit(rlKey, RATE_LIMITS.roadmap.limit, RATE_LIMITS.roadmap.windowMs, Date.now(), true)
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many roadmap requests. Please wait a bit and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }
  const parsed = validateRoadmapInput(await req.json().catch(() => null))
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { goal, level, time, duration, why, style, timeMins, durationDays } = parsed.value
  const size = planRoadmapSize({ timeMins, durationDays })
  const prompt = buildRoadmapPrompt({ goal, level, time, duration, phases: size.phases, lessons: size.lessons, why, styles: style })

  const hasAI = process.env.NVIDIA_NIM_API_KEY

  if (hasAI) {
    try {
      // Single attempt with a 25s call cap (worst ~50s with fallback): fail
      // fast with a friendly 500 instead of tripping the platform's
      // invocation cap. Large roadmaps must use POST /api/roadmaps/async.
      const { content, modelUsed } = await chatForFeature("roadmap", [{role:"user", content: prompt}], { jsonMode: true, maxTokens: size.maxTokens, timeoutMs: 25000, retries: 0 })
      const normalized = normalizeRoadmapJson(JSON.parse(content) as unknown, {
        goal, level, duration,
      })
      if (!normalized) {
        return NextResponse.json({ error: "AI returned an unusable roadmap. Please try again." }, { status: 500 })
      }
      return NextResponse.json({ ...normalized, modelUsed, via: "nim" })
    } catch (e) {
      // Generation failed - return error, NOT fallback template
      console.warn("roadmap NIM generation failed:", getErrorMessage(e))
      return NextResponse.json({ error: "AI temporarily unavailable. Try again later." }, { status: 500 })
    }
  }

  // No NIM key configured
  return NextResponse.json({ error: "AI roadmap generation not configured. Please contact support." }, { status: 500 })
}
