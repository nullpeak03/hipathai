import { Resend } from "resend"

export function isEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

function appUrl(): string {
  // Canonical domain only — hipath.ai is registrar-parked and serves a lander.
  return process.env.APP_URL || "https://www.hipathai.me"
}

/** Send via Resend. Returns false (never throws) when unconfigured or failed. */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    console.warn("[email] skipped — RESEND_API_KEY or EMAIL_FROM not configured")
    return false
  }
  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({ from, to, subject, html })
    if (error) {
      console.error("[email] send failed:", error.message)
      return false
    }
    return true
  } catch (e) {
    console.error("[email] send failed:", e instanceof Error ? e.message : e)
    return false
  }
}

export function streakReminderEmail(name: string | null, streak: number): { subject: string; html: string } {
  const who = name ? `, ${name.split(" ")[0]}` : ""
  return {
    subject: `Don't break your ${streak}-day streak`,
    html: `<p>Hi${who} — you're on a <b>${streak}-day</b> learning streak and haven't studied yet today.</p><p>Even 15 minutes keeps the momentum alive.</p><p><a href="${appUrl()}/roadmap">Continue learning →</a></p><p style="color:#888;font-size:12px">Turn these off anytime in HiPath Settings → Notifications.</p>`,
  }
}
