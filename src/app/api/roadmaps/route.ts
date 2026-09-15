import { NextRequest, NextResponse } from "next/server"
import { chatWithFallback } from "@/lib/nvidia"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=> ({}))
  const goal = body.goal || "AI Agent Developer"
  // Inngest would be triggered here in production to bypass 10s limit
  // For V1 demo, attempt NIMs with fallback to mock JSON
  const prompt = `Generate a CS roadmap JSON for goal "${goal}". Level ${body.level||"Beginner"}, ${body.time||"1hr/day"}, ${body.duration||"8 weeks"}. Return JSON: {title, description, phases:[{title, lessons:[{title, objective}]}]} with 5 phases, ~40 lessons total. JSON only.`
  if (process.env.NVIDIA_NIM_API_KEY || process.env.NIM_API_KEY) {
    try {
      const { content, modelUsed } = await chatWithFallback([{role:"user", content: prompt}], true)
      const data = JSON.parse(content)
      return NextResponse.json({ ...data, modelUsed, via:"nvidia-fallback" })
    } catch (e:any) {
      console.warn("roadmap NIMs failed fallback to mock", e.message)
    }
  }
  return NextResponse.json({ error: "AI not configured — set NVIDIA_NIM_API_KEY to generate roadmaps" }, { status: 503 })
}
