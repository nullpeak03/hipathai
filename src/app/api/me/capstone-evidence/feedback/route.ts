import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { callNim } from "@/lib/nim"
import { checkRateLimit } from "@/lib/rate-limit"
import { isAllowedEvidenceUrl } from "@/lib/capstone-evidence"

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rl = await checkRateLimit(`rl:${userId}:capstone-feedback`, 3, 24 * 60 * 60 * 1000, Date.now(), true)
  if (!rl.ok) {
    return NextResponse.json({ error: "Daily feedback limit reached (3/day)." }, { status: 429 })
  }

  const body = (await req.json().catch(() => null)) as { roadmapId?: string; lessonId?: string } | null
  if (!body?.roadmapId || !body?.lessonId) {
    return NextResponse.json({ error: "Missing roadmapId or lessonId" }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: evidence } = await supabase
    .from("capstone_evidence")
    .select("project_summary,repository_url,deployment_url,implementation_complete,validation_complete,documentation_complete,reflection")
    .eq("user_id", userId)
    .eq("roadmap_id", body.roadmapId)
    .eq("lesson_id", body.lessonId)
    .maybeSingle()

  if (!evidence) {
    return NextResponse.json({ error: "Save capstone evidence first." }, { status: 400 })
  }

  const prompt = `Review this capstone project evidence and give concise, actionable feedback (strengths, gaps, next steps). Evidence: ${JSON.stringify(evidence)}`
  try {
    const { content } = await callNim({ model: process.env.NIM_TUTOR_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b", messages: [{ role: "user", content: prompt }], maxTokens: 600, timeoutMs: 30000 })
    return NextResponse.json({ feedback: content })
  } catch {
    return NextResponse.json({ error: "Feedback unavailable" }, { status: 500 })
  }
}