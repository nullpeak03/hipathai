import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { chatForFeature } from "@/lib/ai-router"
import { getErrorMessage } from "@/lib/utils"
import { normalizeQuizQuestions } from "@/lib/quiz"
import { flattenLessonContent, isLessonContent } from "@/lib/lesson-content-blocks"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"

// POST /api/phases/exam { phaseId } — cumulative phase quiz (6 questions
// sampling the phase's lessons). Ephemeral: not persisted as the lesson
// bank is. Generates from aggregated lesson content.
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { phaseId } = (await req.json().catch(() => ({}))) as { phaseId?: string }
  if (!phaseId) {
    return NextResponse.json({ error: "Missing phaseId" }, { status: 400 })
  }
  const rl = await checkRateLimit(`rl:${userId}:quiz`, RATE_LIMITS.quiz.limit, RATE_LIMITS.quiz.windowMs)
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many quiz requests. Please wait a bit and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  const supabase = createServerClient()
  const { data: phase } = await supabase.from("phases").select("id,roadmap_id,title").eq("id", phaseId).single()
  if (!phase) {
    return NextResponse.json({ error: "Phase not found" }, { status: 404 })
  }
  const { data: roadmap } = await supabase.from("roadmaps").select("user_id").eq("id", (phase as { roadmap_id: string }).roadmap_id).single()
  if (!roadmap || (roadmap as { user_id: string }).user_id !== userId) {
    return NextResponse.json({ error: "Phase not found" }, { status: 404 })
  }

  const { data: lessons } = await supabase.from("lessons").select("title,content_md,content_json").eq("phase_id", phaseId).order("idx")
  const rows = (lessons ?? []) as { title: string; content_md: string | null; content_json: unknown }[]
  if (rows.length === 0) {
    return NextResponse.json({ error: "No lessons in phase" }, { status: 404 })
  }
  const excerpt = rows
    .map((r) => {
      const text = isLessonContent(r.content_json) ? flattenLessonContent(r.content_json) : (r.content_md ?? "")
      return `Lesson: ${r.title}\n${text.slice(0, 800)}`
    })
    .join("\n\n")
    .slice(0, 5000)

  try {
    const prompt = `Generate 6 multiple-choice quiz questions sampling across the phase "${(phase as { title: string }).title}" (${rows.length} lessons). Each question has exactly 4 distinct options and one correct answer (0-3 index); vary the correct position; include a one-sentence explanation. Cover different lessons broadly. Return ONLY valid JSON: {questions:[{q, options:[4 strings], correct, explanation}]}

Phase content:
${excerpt}`

    const { content } = await chatForFeature("quiz",
      [
        { role: "system", content: "You are a JSON generator. Output ONLY valid JSON. No explanations, no markdown, no extra text." },
        { role: "user", content: prompt },
      ],
      { jsonMode: true, maxTokens: 3000, retries: 2 }
    )
    const parsed = JSON.parse(content) as { questions?: unknown }
    const questions = normalizeQuizQuestions(parsed.questions)
    if (!questions) throw new Error("Invalid quiz JSON from model")
    return NextResponse.json({ quiz: questions, phaseId })
  } catch (e) {
    console.warn("[phases/exam] generation failed:", getErrorMessage(e))
    return NextResponse.json({ error: "Phase quiz generation temporarily unavailable" }, { status: 500 })
  }
}
