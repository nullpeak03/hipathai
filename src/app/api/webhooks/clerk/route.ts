import { NextRequest, NextResponse } from "next/server"
import { verifyWebhook } from "@clerk/nextjs/webhooks"

type ClerkUserData = {
  id: string
  email_addresses?: { email_address: string }[]
  first_name?: string | null
  last_name?: string | null
  image_url?: string
}

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req)
    // evt.data contains Clerk user
    const { id, email_addresses, first_name, last_name, image_url } = evt.data as unknown as ClerkUserData
    const email = email_addresses?.[0]?.email_address || null
    const name = [first_name, last_name].filter(Boolean).join(" ") || null

    // upsert to Supabase via service role (bypass RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && serviceKey) {
      const { createClient } = await import("@supabase/supabase-js")
      const supabase = createClient(supabaseUrl, serviceKey)
      await supabase.from("users").upsert({ clerk_id: id, email, name, avatar_url: image_url }, { onConflict: "clerk_id" })
      await supabase.from("gamification").upsert({ user_id: id, xp: 0, level: 1, streak: 0, best_streak: 0, pass_rate: 0, study_minutes: 0, lessons_done: 0 }, { onConflict: "user_id" })
    }
    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("Clerk webhook error", message)
    return new NextResponse("Webhook error", { status: 400 })
  }
}
