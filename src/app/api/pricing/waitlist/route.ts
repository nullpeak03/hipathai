import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { isEmailConfigured, sendEmail } from "@/lib/email"
import { checkRateLimit, HOUR_MS } from "@/lib/rate-limit"
import {
  createWaitlistToken,
  hashWaitlistIp,
  hashWaitlistToken,
  normalizeWaitlistEmail,
} from "@/lib/pricing-waitlist"

const genericResponse = () => NextResponse.json({ ok: true }, { status: 202 })
const appUrl = () => (process.env.APP_URL || "https://www.hipathai.me").replace(/\/+$/, "")

export async function POST(req: NextRequest) {
  let body: { email?: unknown; consent?: unknown; company?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  if (typeof body.company === "string" && body.company.trim()) return genericResponse()
  const email = normalizeWaitlistEmail(body.email)
  if (!email || body.consent !== true) {
    return NextResponse.json({ error: "Enter a valid email and confirm the one-time launch notification." }, { status: 400 })
  }
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "Email confirmation is temporarily unavailable. Please try again later." }, { status: 503 })
  }

  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const ip = req.headers.get("x-real-ip")?.trim() || forwardedFor || "unknown"
  const rateLimit = await checkRateLimit(`rl:pricing-waitlist:${hashWaitlistIp(ip)}`, 5, HOUR_MS)
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
    )
  }
  const emailRateLimit = await checkRateLimit(`rl:pricing-waitlist:email:${hashWaitlistIp(email)}`, 3, HOUR_MS)
  if (!emailRateLimit.ok) {
    return NextResponse.json(
      { error: "Too many confirmation emails requested. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(emailRateLimit.retryAfterMs / 1000)) } }
    )
  }

  let supabase
  try {
    supabase = createServerClient()
  } catch (error) {
    console.error("[pricing/waitlist] database configuration failed:", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ error: "Waitlist signup is temporarily unavailable." }, { status: 503 })
  }

  const { data: existing, error: lookupError } = await supabase
    .from("pro_waitlist_signups")
    .select("id, confirmed_at, unsubscribe_token_hash")
    .eq("email", email)
    .maybeSingle()
  if (lookupError) {
    console.error("[pricing/waitlist] lookup failed:", lookupError.message)
    return NextResponse.json({ error: "Waitlist signup is temporarily unavailable." }, { status: 503 })
  }
  if (existing?.confirmed_at) return genericResponse()

  const confirmationToken = createWaitlistToken()
  const unsubscribeToken = existing?.unsubscribe_token_hash ? null : createWaitlistToken()
  const expiresAt = new Date(Date.now() + 24 * HOUR_MS).toISOString()
  const confirmationTokenHash = hashWaitlistToken(confirmationToken)
  const unsubscribeTokenHash = unsubscribeToken ? hashWaitlistToken(unsubscribeToken) : existing?.unsubscribe_token_hash

  const write = existing
    ? await supabase
        .from("pro_waitlist_signups")
        .update({
          confirmation_token_hash: confirmationTokenHash,
          confirmation_expires_at: expiresAt,
        })
        .eq("id", existing.id)
        .is("confirmed_at", null)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("pro_waitlist_signups")
        .insert({
          email,
          confirmation_token_hash: confirmationTokenHash,
          confirmation_expires_at: expiresAt,
          unsubscribe_token_hash: unsubscribeTokenHash,
        })
        .select("id")
        .maybeSingle()

  if (write.error) {
    if (write.error.code === "23505") return genericResponse()
    console.error("[pricing/waitlist] write failed:", write.error.message)
    return NextResponse.json({ error: "Waitlist signup is temporarily unavailable." }, { status: 503 })
  }
  if (!write.data) return genericResponse()

  const root = appUrl()
  const confirmationUrl = `${root}/pricing/confirm/${confirmationToken}`
  const removeUrl = `${root}/pricing/remove/${unsubscribeToken ?? ""}`
  const sent = await sendEmail(
    email,
    "Confirm your HiPath Pro launch notification",
    `<p>Confirm your email if you want one notification when HiPath Pro launches.</p><p><a href="${confirmationUrl}">Confirm my email</a></p><p>This is not a subscription or payment. We will not send newsletters or ongoing marketing. To withdraw before launch, <a href="${removeUrl}">remove this address from the waitlist</a>.</p><p style="color:#888;font-size:12px">If you didn’t request this, ignore this email.</p>`
  )
  if (!sent) {
    return NextResponse.json({ error: "We couldn’t send the confirmation email. Please try again later." }, { status: 503 })
  }
  return genericResponse()
}
