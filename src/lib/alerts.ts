import { sendEmail } from "./email"

// Best-effort admin alerts for terminal production failures (Inngest
// onFailure paths). Needs ADMIN_ALERT_EMAIL set — silently skipped otherwise.
// Throttled to 1/hour per scope so a bad stretch doesn't become a mailbomb.
// Never throws: alerts must never break the caller.

const lastSent = new Map<string, number>()
const THROTTLE_MS = 60 * 60 * 1000

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export async function sendAdminAlert(scope: string, subject: string, body: string): Promise<void> {
  try {
    const to = process.env.ADMIN_ALERT_EMAIL || ""
    if (!to) return
    const now = Date.now()
    if (now - (lastSent.get(scope) ?? 0) < THROTTLE_MS) return
    lastSent.set(scope, now)
    await sendEmail(
      to,
      `[HiPath AI] ${subject}`,
      `<p><b>${escapeHtml(scope)}</b> — ${new Date(now).toISOString()}</p><pre>${escapeHtml(body).slice(0, 2000)}</pre>`
    )
  } catch {
    // alerting is fire-and-forget
  }
}

/** Reset throttle (tests). */
export function resetAlertThrottle(): void {
  lastSent.clear()
}
