import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { hashWaitlistToken } from "@/lib/pricing-waitlist"

export async function POST(req: NextRequest) {
  let token: unknown
  try {
    token = (await req.json() as { token?: unknown }).token
  } catch {
    return NextResponse.json({ error: "Invalid confirmation link." }, { status: 400 })
  }
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.json({ error: "Invalid confirmation link." }, { status: 400 })
  }

  let supabase
  try {
    supabase = createServerClient()
  } catch (error) {
    console.error("[pricing/waitlist/confirm] database configuration failed:", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ error: "Confirmation is temporarily unavailable." }, { status: 503 })
  }
  const { data, error } = await supabase
    .from("pro_waitlist_signups")
    .update({
      confirmed_at: new Date().toISOString(),
      confirmation_token_hash: null,
      confirmation_expires_at: null,
    })
    .eq("confirmation_token_hash", hashWaitlistToken(token))
    .gt("confirmation_expires_at", new Date().toISOString())
    .is("confirmed_at", null)
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("[pricing/waitlist/confirm] update failed:", error.message)
    return NextResponse.json({ error: "Confirmation is temporarily unavailable." }, { status: 503 })
  }
  if (!data) return NextResponse.json({ error: "This confirmation link is invalid, expired, or already used." }, { status: 400 })
  return NextResponse.json({ ok: true })
}
