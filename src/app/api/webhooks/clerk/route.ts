import { NextRequest, NextResponse } from "next/server"
import { verifyWebhook } from "@clerk/nextjs/webhooks"

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req)
    // evt.data contains Clerk user
    const { id, email_addresses, first_name, last_name, image_url } = evt.data as any
    const email = email_addresses?.[0]?.email_address || null
    const name = [first_name, last_name].filter(Boolean).join(" ") || null

    // upsert to Supabase via service role (bypass RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || (process.env as any).DATABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env as any).SERVICE_ROLE
    if (supabaseUrl && serviceKey) {
      const { createClient } = await import("@supabase/supabase-js")
      const supabase = createClient(supabaseUrl, serviceKey)
      await supabase.from("users").upsert({ clerk_id: id, email, name, avatar_url: image_url }, { onConflict: "clerk_id" })
      await supabase.from("gamification").upsert({ user_id: id, xp: 0, level: 1, streak: 0, best_streak: 0, pass_rate: 0, study_minutes: 0, lessons_done: 0 }, { onConflict: "user_id" })
    }
    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error("Clerk webhook error", err.message)
    return new NextResponse("Webhook error", { status: 400 })
  }
}
