import { inngest } from "./client"
import { createServerClient } from "@/lib/supabase/server"
import { isEmailConfigured, sendEmail, streakReminderEmail } from "@/lib/email"

// Daily streak reminders: learners with an active streak who logged no
// study time today get one email (opt-out via users.email_reminders).
// Skipped entirely when RESEND_API_KEY/EMAIL_FROM are unset.
export const streakReminderFn = inngest.createFunction(
  { id: "streak-reminder-daily", triggers: [{ cron: "0 13 * * *" }] },
  async () => {
    if (!isEmailConfigured()) {
      console.log("[reminders] skipped — email not configured")
      return { skipped: true as const }
    }
    const supabase = createServerClient()
    const today = new Date().toISOString().slice(0, 10)

    const { data: gams } = await supabase
      .from("gamification")
      .select("user_id,streak")
      .gt("streak", 0)
    const { data: acts } = await supabase
      .from("daily_activity")
      .select("user_id")
      .eq("activity_date", today)
    const activeToday = new Set(
      (((acts ?? []) as { user_id: string }[])).map((a) => a.user_id)
    )
    const idle = (((gams ?? []) as { user_id: string; streak: number | null }[])).filter(
      (g) => !activeToday.has(g.user_id)
    )
    if (idle.length === 0) {
      return { checked: 0, sent: 0 }
    }

    const { data: users } = await supabase
      .from("users")
      .select("clerk_id,email,name,email_reminders")
      .in(
        "clerk_id",
        idle.map((g) => g.user_id)
      )
    const streakByUser = new Map(idle.map((g) => [g.user_id, g.streak ?? 0]))
    const targets = (((users ?? []) as {
      clerk_id: string
      email: string | null
      name: string | null
      email_reminders: boolean | null
    }[])).filter((u) => u.email && (u.email_reminders ?? true))

    let sent = 0
    for (const u of targets.slice(0, 200)) {
      const streak = streakByUser.get(u.clerk_id) ?? 0
      const { subject, html } = streakReminderEmail(u.name, streak)
      if (u.email && (await sendEmail(u.email, subject, html))) sent++
    }
    console.log(`[reminders] checked ${idle.length}, sent ${sent}`)
    return { checked: idle.length, sent }
  }
)
