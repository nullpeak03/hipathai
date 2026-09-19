import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { chatWithGemini } from "@/lib/gemini"
import { getErrorMessage } from "@/lib/utils"
import { userOwnsLesson } from "@/lib/lesson-access"
import {
  buildLessonPrompt,
  splitLessonContent,
  needsRealContent,
} from "@/lib/lesson-content"

// POST /api/lessons/content { lessonId, regenerate? }
// Generates the full Standard lesson (body + runnable example) on demand.
// Idempotent: returns the stored lesson when real content already exists
// unless regenerate:true (the UI confirms before sending that).
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { lessonId, regenerate } = (await req.json().catch(() => ({}))) as {
    lessonId?: string
    regenerate?: boolean
  }
  if (!lessonId) {
    return NextResponse.json({ error: "Missing lessonId" }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id,roadmap_id,title,content_md,example_code")
    .eq("id", lessonId)
    .single()
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
  }

  // Ownership check — never leak or generate for another user's content
  if (!(await userOwnsLesson(supabase, userId, lessonId))) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
  }

  const existing = (lesson.content_md ?? "") as string
  const existingExample = (lesson.example_code ?? "") as string
  if (!regenerate && !needsRealContent(existing)) {
    return NextResponse.json({ contentMd: existing, exampleCode: existingExample, cached: true })
  }

  // Personalize from the learner's roadmap (level/style/goal)
  const { data: roadmap } = await supabase
    .from("roadmaps")
    .select("goal,level,style")
    .eq("id", (lesson.roadmap_id ?? "") as string)
    .single()
  const rm = (roadmap ?? {}) as { goal?: string | null; level?: string | null; style?: string | null }
  const objective = existing.replace(/^##\s+.*\n/, "").trim().slice(0, 500)

  try {
    const { content } = await chatWithGemini(
      [
        {
          role: "system",
          content: "You are a programming instructor writing a focused lesson. Follow the requested structure exactly. Plain text only.",
        },
        {
          role: "user",
          content: buildLessonPrompt({
            title: (lesson.title ?? "lesson") as string,
            objective,
            level: rm.level ?? undefined,
            style: rm.style ?? undefined,
            goal: rm.goal ?? undefined,
          }),
        },
      ],
      false,
      55000,
      4000,
      { key: "roadmap" }
    )
    const split = splitLessonContent(content)
    if (!split) {
      throw new Error("Invalid lesson content from model")
    }
    await supabase
      .from("lessons")
      .update({ content_md: split.contentMd, example_code: split.exampleCode })
      .eq("id", lessonId)
    return NextResponse.json({ contentMd: split.contentMd, exampleCode: split.exampleCode, cached: false })
  } catch (e) {
    console.warn("[lessons/content] generation failed:", getErrorMessage(e))
    return NextResponse.json({ error: "Lesson generation temporarily unavailable" }, { status: 500 })
  }
}
