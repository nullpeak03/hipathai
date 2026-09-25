import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { chatForFeature } from "@/lib/ai-router"
import { getErrorMessage } from "@/lib/utils"
import { userOwnsLesson } from "@/lib/lesson-access"
import { buildQuizPrompt, normalizeQuizQuestions, needsRealQuiz, QUIZ_MIN_BANK, type QuizMode } from "@/lib/quiz"
import { flattenLessonContent, isLessonContent } from "@/lib/lesson-content-blocks"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { inngest } from "@/lib/inngest/client"
import type { QuizQuestion } from "@/lib/mockData"

// POST /api/lessons/quiz { lessonId, mode? }
// Returns the lesson's quiz, generating it with AI on first request when the
// stored quiz is still a seed placeholder (lazy generation keeps roadmap
// creation fast). Modes: standard (persisted as the canonical assessment),
// remedial (easier practice set) and challenge (harder practice set) —
// practice variants are never persisted, so retries can't corrupt grading.
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { lessonId, mode } = (await req.json().catch(() => ({}))) as { lessonId?: string; mode?: string }
  if (!lessonId) {
    return NextResponse.json({ error: "Missing lessonId" }, { status: 400 })
  }
  const rl = await checkRateLimit(`rl:${userId}:quiz`, RATE_LIMITS.quiz.limit, RATE_LIMITS.quiz.windowMs)
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many quiz requests. Please wait a bit and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    )
  }
  const quizMode: QuizMode = mode === "remedial" || mode === "challenge" ? mode : "standard"

  const supabase = createServerClient()
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id,roadmap_id,title,content_md,content_json,quiz,quiz_bank")
    .eq("id", lessonId)
    .single()
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
  }

  // Ownership check — never leak another user's content
  if (!(await userOwnsLesson(supabase, userId, lessonId))) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
  }

  const bank = ((lesson as { quiz_bank?: QuizQuestion[] | null }).quiz_bank ?? (lesson.quiz ?? [])) as QuizQuestion[]
  const hasFullBank = bank.length >= QUIZ_MIN_BANK && !needsRealQuiz(bank)
  if (quizMode === "standard" && hasFullBank) {
    return NextResponse.json({ quiz: bank, cached: true })
  }

  // Standard bank (up to 10 Qs) is too heavy for Vercel 60s — run async via Inngest.
  // Remedial/challenge (short ranges) stay sync for instant UX.
  if (quizMode === "standard") {
    const jobId = crypto.randomUUID()
    const { error: jobError } = await supabase.from("async_jobs").upsert({
      id: jobId,
      status: "processing",
      started_at: new Date().toISOString(),
    }, { onConflict: "id" })
    if (jobError) {
      console.error("[lessons/quiz] Failed to create job:", jobError.message)
      return NextResponse.json({ error: "Could not start quiz generation" }, { status: 500 })
    }
    try {
      await inngest.send({ name: "quiz/generate", data: { jobId, lessonId, userId, mode: quizMode } })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error("[lessons/quiz] Inngest send failed:", msg)
      await supabase.from("async_jobs").upsert({ id: jobId, status: "failed", error: msg, completed_at: new Date().toISOString() }, { onConflict: "id" })
      return NextResponse.json({ error: "Could not start quiz generation" }, { status: 500 })
    }
    return NextResponse.json({ jobId, status: "processing" }, { status: 202 })
  }

  try {
    const row = lesson as { title?: string; content_md?: string | null; content_json?: unknown }
    const lessonText = isLessonContent(row.content_json)
      ? flattenLessonContent(row.content_json)
      : (row.content_md ?? "")
    const { content } = await chatForFeature("quiz",
      [
        { role: "system", content: "You are a JSON generator. Output ONLY valid JSON. No explanations, no markdown, no extra text." },
        { role: "user", content: buildQuizPrompt(row.title ?? "lesson", lessonText, quizMode) },
      ],
      { jsonMode: true, maxTokens: 2000, retries: 0, timeoutMs: 25000 }
    )
    const parsed = JSON.parse(content) as { questions?: unknown }
    const questions = normalizeQuizQuestions(parsed.questions)
    if (!questions) {
      throw new Error("Invalid quiz JSON from model")
    }
    return NextResponse.json({ quiz: questions, cached: false, mode: quizMode })
  } catch (e) {
    console.warn("[lessons/quiz] generation failed:", getErrorMessage(e))
    return NextResponse.json({ error: "Quiz generation temporarily unavailable" }, { status: 500 })
  }
}

/**
 * DELETE /api/lessons/quiz { lessonId } — clear a caller-owned lesson's quiz
 * bank after a pass (fresh questions on retake). Progress/scores are kept;
 * only the question content is removed.
 */
export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { lessonId } = (await req.json().catch(() => ({}))) as { lessonId?: string }
  if (!lessonId) {
    return NextResponse.json({ error: "Missing lessonId" }, { status: 400 })
  }
  const supabase = createServerClient()
  if (!(await userOwnsLesson(supabase, userId, lessonId))) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
  }
  const { error } = await supabase
    .from("lessons")
    .update({ quiz_bank: null, quiz: [] })
    .eq("id", lessonId)
  if (error) {
    console.error("[lessons/quiz] Failed to clear bank:", error.message)
    return NextResponse.json({ error: "Could not clear quiz" }, { status: 500 })
  }
  return NextResponse.json({ deleted: true })
}
