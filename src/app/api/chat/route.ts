import { NextRequest } from "next/server"
import { chatWithFallback } from "@/lib/nvidia"

// Edge for streaming
export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json()
    const sys = `You are HiPath AI Mentor + Tutor (merged). Persistent AI mentor for Computer Science & Technology. Context: roadmap=${context?.roadmapTitle || "No roadmap yet"}, Lv.${context?.level||1} ${context?.xp||0}XP streak ${context?.streak||0}d. Be concise, motivational, adapt to weaknesses. Use Nvidia-only fallback logic mentally.`
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
    // no hardcoded Python mock — return neutral fallback if NIMs not configured
    const last = messages?.[messages.length-1]?.content || ""
    let mock = `Thanks for your message: "${last.slice(0,120)}". I'm your HiPath mentor — tell me your goal and I'll guide you step by step.`
    if (/progress/i.test(last)) mock = `You're at Lv.${context?.level||1} with ${context?.xp||0} XP and a ${context?.streak||0}-day streak. Keep up the daily practice to build momentum!`
    return new Response(JSON.stringify({ content: mock, modelUsed: "mock" }), { headers: { "Content-Type": "application/json" } })
  } catch (e:any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}
