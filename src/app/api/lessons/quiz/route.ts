import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { chatWithFallback } from "@/lib/nvidia"
import { getErrorMessage } from "@/lib/utils"
import { userOwnsLesson } from "@/lib/lesson-access"
import { buildQuizPrompt, isValidQuiz, needsRealQuiz, type QuizMode } from "@/lib/quiz"
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
  const quizMode: QuizMode = mode === "remedial" || mode === "challenge" ? mode : "standard"

  const supabase = createServerClient()
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id,roadmap_id,title,content_md,quiz")
    .eq("id", lessonId)
    .single()
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
  }

  // Ownership check — never leak another user's content
  if (!(await userOwnsLesson(supabase, userId, lessonId))) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
  }

  const existing = (lesson.quiz ?? []) as QuizQuestion[]
  if (quizMode === "standard" && !needsRealQuiz(existing)) {
    return NextResponse.json({ quiz: existing, cached: true })
  }

  try {
    const { content } = await chatWithFallback(
      [
        { role: "system", content: "You are a JSON generator. Output ONLY valid JSON. No explanations, no markdown, no extra text." },
        { role: "user", content: buildQuizPrompt(lesson.title ?? "lesson", lesson.content_md ?? "", quizMode) },
      ],
      true,
      undefined,
      2000
    )
    const parsed = JSON.parse(content) as { questions?: unknown }
    if (!isValidQuiz(parsed.questions)) {
      throw new Error("Invalid quiz JSON from model")
    }
    // Only the standard set becomes the canonical stored assessment
    if (quizMode === "standard") {
      await supabase.from("lessons").update({ quiz: parsed.questions }).eq("id", lessonId)
    }
    return NextResponse.json({ quiz: parsed.questions, cached: false, mode: quizMode })
  } catch (e) {
    console.warn("[lessons/quiz] generation failed:", getErrorMessage(e))
    return NextResponse.json({ error: "Quiz generation temporarily unavailable" }, { status: 500 })
  }
}
