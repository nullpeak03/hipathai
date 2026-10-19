import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"

type Prefs = {
  email: string | null
  emailReminders: boolean
  dailyGoalMinutes: number
  tutorMode: "direct" | "socratic"
  difficultyPreference: "adaptive" | "beginner" | "intermediate" | "advanced"
  reducedMotion: boolean
  fontSize: number
  highContrast: boolean
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const supabase = createServerClient()
  const { data } = await supabase
    .from("users")
    .select("email,email_reminders,daily_goal_minutes,tutor_mode,difficulty_preference,reduced_motion,font_size,high_contrast")
    .eq("clerk_id", userId)
    .single()
  const row = (data ?? {}) as Record<string, unknown>
  const prefs: Prefs = {
    email: (row.email as string | null) ?? null,
    emailReminders: (row.email_reminders as boolean | null) ?? true,
    dailyGoalMinutes: Number(row.daily_goal_minutes ?? 60),
    tutorMode: row.tutor_mode === "socratic" ? "socratic" : "direct",
    difficultyPreference: (row.difficulty_preference as Prefs["difficultyPreference"]) ?? "adaptive",
    reducedMotion: Boolean(row.reduced_motion ?? false),
    fontSize: Number(row.font_size ?? 14),
    highContrast: Boolean(row.high_contrast ?? false),
  }
  return NextResponse.json(prefs)
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as Partial<Prefs>
  const update: Record<string, unknown> = {}
  if (typeof body.emailReminders === "boolean") update.email_reminders = body.emailReminders
  if (typeof body.dailyGoalMinutes === "number") update.daily_goal_minutes = Math.max(15, Math.min(240, Math.round(body.dailyGoalMinutes)))
  if (body.tutorMode === "direct" || body.tutorMode === "socratic") update.tutor_mode = body.tutorMode
  if (body.difficultyPreference) update.difficulty_preference = body.difficultyPreference
  if (typeof body.reducedMotion === "boolean") update.reduced_motion = body.reducedMotion
  if (typeof body.fontSize === "number") update.font_size = Math.max(12, Math.min(20, Math.round(body.fontSize)))
  if (typeof body.highContrast === "boolean") update.high_contrast = body.highContrast
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "No valid fields" }, { status: 400 })
  const supabase = createServerClient()
  const { error } = await supabase.from("users").update(update).eq("clerk_id", userId)
  if (error) return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 })
  return NextResponse.json({ ok: true })
}
