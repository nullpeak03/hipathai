import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"

// GET /api/me/preferences — notification prefs for the caller.
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const supabase = createServerClient()
  const { data } = await supabase
    .from("users")
    .select("email,email_reminders")
    .eq("clerk_id", userId)
    .single()
  const row = (data ?? { email: null, email_reminders: true }) as {
    email: string | null
    email_reminders: boolean | null
  }
  return NextResponse.json({ email: row.email, emailReminders: row.email_reminders ?? true })
}

// PATCH /api/me/preferences { emailReminders } — opt in/out of emails.
export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = (await req.json().catch(() => ({}))) as { emailReminders?: boolean }
  if (typeof body.emailReminders !== "boolean") {
    return NextResponse.json({ error: "Missing emailReminders" }, { status: 400 })
  }
  const supabase = createServerClient()
  const { error } = await supabase
    .from("users")
    .update({ email_reminders: body.emailReminders })
    .eq("clerk_id", userId)
  if (error) {
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 })
  }
  return NextResponse.json({ ok: true, emailReminders: body.emailReminders })
}
