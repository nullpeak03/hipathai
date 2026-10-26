import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { hashWaitlistToken } from "@/lib/pricing-waitlist"

export async function POST(req: NextRequest) {
  let token: unknown
  try {
    token = (await req.json() as { token?: unknown }).token
  } catch {
    return NextResponse.json({ error: "Invalid removal link." }, { status: 400 })
  }
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.json({ error: "Invalid removal link." }, { status: 400 })
  }

  let supabase
  try {
    supabase = createServerClient()
  } catch (error) {
    console.error("[pricing/waitlist/remove] database configuration failed:", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ error: "Waitlist removal is temporarily unavailable." }, { status: 503 })
  }
  const { error } = await supabase
    .from("pro_waitlist_signups")
    .delete()
    .eq("unsubscribe_token_hash", hashWaitlistToken(token))

  if (error) {
    console.error("[pricing/waitlist/remove] delete failed:", error.message)
    return NextResponse.json({ error: "Waitlist removal is temporarily unavailable." }, { status: 503 })
  }
  return NextResponse.json({ ok: true })
}
