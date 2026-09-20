import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { userOwnsLesson } from "@/lib/lesson-access"
import { chatForFeature } from "@/lib/ai-router"
import { buildWeaknessPrompt } from "@/lib/weakness-prompt"
import { getErrorMessage } from "@/lib/utils"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"

// POST /api/me/weakness-insight { lessonId, score? } — AI remediation for a
// failed quiz: likely misunderstanding + one concrete study tip. Persisted
// to weakness_insights history; weak_topics stays the aggregate counter.
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { lessonId, score } = (await req.json().catch(() => ({}))) as {
    lessonId?: string
    score?: number
  }
  if (!lessonId) {
    return NextResponse.json({ error: "Missing lessonId" }, { status: 400 })
  }
  const rl = checkRateLimit(`rl:${userId}:weakness`, RATE_LIMITS.weakness.limit, RATE_LIMITS.weakness.windowMs)
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a bit and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }

  const supabase = createServerClient()
  if (!(await userOwnsLesson(supabase, userId, lessonId))) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
  }
  const { data: lesson } = await supabase
    .from("lessons")
    .select("title")
    .eq("id", lessonId)
    .single()
  const topic = ((lesson as { title: string } | null)?.title ?? "this lesson") as string

  const { data: weak } = await supabase
    .from("weak_topics")
    .select("fail_count")
    .eq("user_id", userId)
    .eq("topic", topic)
    .single()
  const failCount = (((weak as { fail_count: number | null } | null)?.fail_count) ?? 1) as number

  try {
    const { content } = await chatForFeature(
      "weakness",
      [{ role: "user", content: buildWeaknessPrompt({ topic, score: score ?? 0, failCount }) }],
      { maxTokens: 400 }
    )
    const suggestion = content.trim().slice(0, 2000)
    if (suggestion.length < 40) throw new Error("Suggestion too short")
    await supabase.from("weakness_insights").insert({
      user_id: userId,
      lesson_id: lessonId,
      topic,
      suggestion,
      score: typeof score === "number" ? score : null,
    })
    return NextResponse.json({ suggestion })
  } catch (e) {
    console.warn("[weakness-insight] generation failed:", getErrorMessage(e))
    return NextResponse.json({ error: "Insight temporarily unavailable" }, { status: 500 })
  }
}
