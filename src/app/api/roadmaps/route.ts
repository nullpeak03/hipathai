import { NextRequest, NextResponse } from "next/server"
import { chatWithFallback } from "@/lib/nvidia"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=> ({}))
  const goal = body.goal || "AI Agent Developer"
  // Inngest would be triggered here in production to bypass 10s limit
  // For V1 demo, attempt NIMs with fallback to mock JSON
  const prompt = `Generate a CS roadmap JSON for goal "${goal}". Level ${body.level||"Beginner"}, ${body.time||"1hr/day"}, ${body.duration||"8 weeks"}. Return JSON: {title, description, phases:[{title, lessons:[{title, objective}]}]} with 5 phases, ~40 lessons total. JSON only.`
  const hasNIM = process.env.NVIDIA_NIM_API_KEY || (process.env as any).NVIDIA_API_KEY || process.env.NIM_API_KEY || (process.env as any).NIM_FALLBACK_MODELS
  if (hasNIM) {
    try {
      const { content, modelUsed } = await chatWithFallback([{role:"user", content: prompt}], true)
      const data = JSON.parse(content)
      return NextResponse.json({ ...data, modelUsed, via:"nvidia-fallback" })
    } catch (e:any) {
      console.warn("roadmap NIMs failed, using fallback generator", e.message)
      // Fallback: generate a basic structured roadmap without NIMs so flow continues
      const fallback = {
        title: `${goal} Roadmap (2026 Edition)`,
        description: `Personalized roadmap for ${goal} — Level ${body.level||"Beginner"}, ${body.time||"1hr/day"}, ${body.duration||"8 weeks"}.`,
        phases: Array.from({ length: 5 }, (_, pi) => ({
          title: `Phase ${pi+1}: ${["Foundations","Core Concepts","Intermediate","Advanced","Capstone"][pi] || `Phase ${pi+1}`}`,
          lessons: Array.from({ length: 8 }, (_, li) => ({
            title: `${goal} — Lesson ${pi*8 + li + 1}`,
            objective: `Learn and practice ${goal} concept ${li+1} in phase ${pi+1}.`
          }))
        }))
      }
      return NextResponse.json({ ...fallback, modelUsed: "fallback", via:"fallback-generator" })
    }
  }
  // No NIM key at all — still provide fallback so onboarding never blocks
  const fallback = {
    title: `${goal} Roadmap (2026 Edition)`,
    description: `Personalized roadmap for ${goal} — generated without AI (configure NIMs for richer content).`,
    phases: Array.from({ length: 5 }, (_, pi) => ({
      title: `Phase ${pi+1}`,
      lessons: Array.from({ length: 8 }, (_, li) => ({ title: `${goal} Lesson ${pi*8+li+1}`, objective: `Objective for ${goal} lesson ${li+1}` }))
    }))
  }
  return NextResponse.json({ ...fallback, modelUsed: "fallback-no-key", via:"fallback-no-key" })
}
