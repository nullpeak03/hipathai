import { NextRequest, NextResponse } from "next/server"
import { chatWithFallback } from "@/lib/nvidia"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const goal = body.goal || "AI Agent Developer"
  const prompt = `Generate a CS roadmap for goal "${goal}". Level: ${body.level||"Beginner"}, Time: ${body.time||"1hr/day"}, Duration: ${body.duration||"8 weeks"}. Create EXACTLY 5 phases with ~40 lessons total. Each lesson title must be UNIQUE and goal-specific (not "AI Agent Developer — Lesson X"). Each objective must be a concise sentence (8-12 words) describing what the learner will achieve. Return ONLY valid JSON: {title, description, phases:[{title, lessons:[{title, objective}]}]} No explanatory text, no markdown fences, no "Here's a thinking process:" prefix.`

  const hasNIM = process.env.NVIDIA_NIM_API_KEY || (process.env as any).NVIDIA_API_KEY || process.env.NIM_API_KEY

  if (hasNIM) {
    try {
      const { content, modelUsed } = await chatWithFallback([{role:"user", content: prompt}], true)
      const data = JSON.parse(content)
      return NextResponse.json({ ...data, modelUsed, via:"nvidia-fallback" })
    } catch (e:any) {
      // All models failed - return error, NOT fallback template
      console.warn("roadmap NIMs all models failed:", e.message)
      return NextResponse.json({ error: "AI temporarily unavailable. Try again later." }, { status: 500 })
    }
  }

  // No NIM key configured
  return NextResponse.json({ error: "AI roadmap generation not configured. Please contact support." }, { status: 500 })
}