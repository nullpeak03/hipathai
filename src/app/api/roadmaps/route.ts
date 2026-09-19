import { NextRequest, NextResponse } from "next/server"
import { chatWithFallback } from "@/lib/nvidia"
import { getErrorMessage } from "@/lib/utils"
import { buildRoadmapPrompt } from "@/lib/roadmap-prompt"
import { normalizeRoadmapJson } from "@/lib/roadmap-normalize"

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    goal?: string
    level?: string
    time?: string
    duration?: string
  }
  const goal = body.goal || "AI Agent Developer"
  const prompt = buildRoadmapPrompt({ goal, level: body.level, time: body.time, duration: body.duration })

  const hasNIM = process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY || process.env.NIM_API_KEY

  if (hasNIM) {
    try {
      // Single attempt with a near-limit timeout: full generations take ~60s.
      // Large roadmaps should use POST /api/roadmaps/async instead.
      const { content, modelUsed } = await chatWithFallback([{role:"user", content: prompt}], true, 55000, 8000, { retries: 0 })
      const normalized = normalizeRoadmapJson(JSON.parse(content) as unknown, {
        goal, level: body.level ?? "Beginner", duration: body.duration ?? "8 weeks",
      })
      if (!normalized) {
        return NextResponse.json({ error: "AI returned an unusable roadmap. Please try again." }, { status: 500 })
      }
      return NextResponse.json({ ...normalized, modelUsed, via:"nvidia-fallback" })
    } catch (e) {
      // All models failed - return error, NOT fallback template
      console.warn("roadmap NIMs all models failed:", getErrorMessage(e))
      return NextResponse.json({ error: "AI temporarily unavailable. Try again later." }, { status: 500 })
    }
  }

  // No NIM key configured
  return NextResponse.json({ error: "AI roadmap generation not configured. Please contact support." }, { status: 500 })
}