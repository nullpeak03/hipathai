import { NextRequest, NextResponse } from "next/server"
import { chatWithGemini } from "@/lib/gemini"
import { getErrorMessage } from "@/lib/utils"
import { buildRoadmapPrompt } from "@/lib/roadmap-prompt"
import { normalizeRoadmapJson } from "@/lib/roadmap-normalize"
import { planRoadmapSize, parseTimeToMinutes, parseDurationToDays } from "@/lib/roadmap-sizing"

export async function POST(req: NextRequest) {
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

  const hasGemini = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY

  if (hasGemini) {
    try {
      // Single attempt with a near-limit timeout: full generations take ~60s.
      // Large roadmaps should use POST /api/roadmaps/async instead.
      const { content, modelUsed } = await chatWithGemini([{role:"user", content: prompt}], true, 55000, size.maxTokens, { retries: 0, key: "roadmap" })
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
