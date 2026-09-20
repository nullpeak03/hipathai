import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { chatForFeature } from "@/lib/ai-router"
import { getErrorMessage } from "@/lib/utils"
import { buildRoadmapPrompt } from "@/lib/roadmap-prompt"
import { normalizeRoadmapJson } from "@/lib/roadmap-normalize"
import { planRoadmapSize, parseTimeToMinutes, parseDurationToDays } from "@/lib/roadmap-sizing"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
  // NOTE: best-effort sync endpoint with a ~55s budget. Full roadmaps often
  // take longer — prefer POST /api/roadmaps/async (Inngest + polling).
  console.warn("[roadmaps/sync] sync generation requested (prefer /async for reliability)")
  const { userId } = await auth()
  const rlKey = `rl:${userId ?? req.headers.get("x-forwarded-for") ?? "anon"}:roadmap`
  const rl = checkRateLimit(rlKey, RATE_LIMITS.roadmap.limit, RATE_LIMITS.roadmap.windowMs)
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many roadmap requests. Please wait a bit and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }
  const body = (await req.json().catch(() => ({}))) as {
    goal?: string
    level?: string
    time?: string
    duration?: string
  }
  const goal = body.goal || "AI Agent Developer"
  const size = planRoadmapSize({
    timeMins: parseTimeToMinutes(body.time || "1hr/day"),
    durationDays: parseDurationToDays(body.duration || "8 weeks"),
  })
  const prompt = buildRoadmapPrompt({ goal, level: body.level, time: body.time, duration: body.duration, phases: size.phases, lessons: size.lessons })

  const hasAI = process.env.NVIDIA_NIM_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY

  if (hasAI) {
    try {
      // Single attempt with a near-limit timeout: full generations take ~60s.
      // Large roadmaps should use POST /api/roadmaps/async instead.
      const { content, modelUsed } = await chatForFeature("roadmap", [{role:"user", content: prompt}], { jsonMode: true, maxTokens: size.maxTokens, timeoutMs: 55000, retries: 0 })
      const normalized = normalizeRoadmapJson(JSON.parse(content) as unknown, {
        goal, level: body.level ?? "Beginner", duration: body.duration ?? "8 weeks",
      })
      if (!normalized) {
        return NextResponse.json({ error: "AI returned an unusable roadmap. Please try again." }, { status: 500 })
      }
      return NextResponse.json({ ...normalized, modelUsed, via:"gemini" })
    } catch (e) {
      // Generation failed - return error, NOT fallback template
      console.warn("roadmap Gemini generation failed:", getErrorMessage(e))
      return NextResponse.json({ error: "AI temporarily unavailable. Try again later." }, { status: 500 })
    }
  }

  // No Gemini key configured
  return NextResponse.json({ error: "AI roadmap generation not configured. Please contact support." }, { status: 500 })
}
