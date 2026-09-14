import { NextRequest } from "next/server"
import { chatWithFallback } from "@/lib/nvidia"

// Edge for streaming
export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json()
    const sys = `You are HiPath AI Mentor + Tutor (merged). Persistent AI mentor for Computer Science & Technology. Context: roadmap=${context?.roadmapTitle || "AI Agent Developer"}, Lv.${context?.level||3} ${context?.xp||250}XP streak ${context?.streak||8}d. Be concise, motivational, adapt to weaknesses. If user asks progress, mention streak and Python focus. Use Nvidia-only fallback logic mentally.`
    const all = [{ role: "system" as const, content: sys }, ...(messages || [])]

    // try real NIMs if key set
    if (process.env.NVIDIA_NIM_API_KEY || process.env.NIM_API_KEY) {
      try {
        const { content, modelUsed } = await chatWithFallback(all)
        return new Response(JSON.stringify({ content, modelUsed }), { headers: { "Content-Type": "application/json" } })
      } catch (e:any) {
        // fallback to mock if all models fail
        if (e.message.includes("MISSING") || e.message.includes("FAILED")) {
          // continue to mock
        } else throw e
      }
    }
    // mock fallback
    const last = messages?.[messages.length-1]?.content || ""
    let mock = `You're doing great! You asked: "${last.slice(0,120)}" — as your HiPath mentor I see you're on Lv.${context?.level||3}. Keep focusing on Python fundamentals (data types, functions). Need a quiz?`
    if (/progress/i.test(last)) mock = `You're maintaining an ${context?.streak||8}-day learning streak! As a beginner, you're actively building your foundation in Python, focusing on strengthening areas like data types, parameters, and VS Code proficiency. Keep up the consistent effort!`
    return new Response(JSON.stringify({ content: mock, modelUsed: "mock" }), { headers: { "Content-Type": "application/json" } })
  } catch (e:any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}
