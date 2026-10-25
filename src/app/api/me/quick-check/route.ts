import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { lessonIsUnlocked } from "@/lib/assessment-server"

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => null)) as {
    lessonId?: unknown
    sectionIndex?: unknown
    answer?: unknown
  } | null
  if (
    typeof body?.lessonId !== "string"
    || !Number.isInteger(body.sectionIndex)
    || !Number.isInteger(body.answer)
    || (body.sectionIndex as number) < 0
    || (body.answer as number) < 0
  ) {
    return NextResponse.json({ error: "Invalid quick-check answer" }, { status: 400 })
  }

  const supabase = createServerClient()
  if (!(await lessonIsUnlocked(supabase, userId, body.lessonId))) {
    return NextResponse.json({ error: "Complete the required earlier lessons first." }, { status: 403 })
  }
  const { data, error } = await supabase.rpc("award_quick_check", {
    p_user_id: userId,
    p_lesson_id: body.lessonId,
    p_section_index: body.sectionIndex,
    p_answer: body.answer,
  })
  if (error) {
    if (error.message.includes("lesson_not_found") || error.message.includes("quick_check_not_found")) {
      return NextResponse.json({ error: "Quick check not found" }, { status: 404 })
    }
    console.error("[quick-check] Award failed:", error.message)
    return NextResponse.json({ error: "Could not check answer" }, { status: 500 })
  }
  return NextResponse.json(data)
}
