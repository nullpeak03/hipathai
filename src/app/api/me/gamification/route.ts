import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { toGamificationRow } from "@/lib/gamification"

// POST /api/me/gamification { gam } — upsert caller's counters.
// Numbers are sanitized server-side; the date is stamped by the server
// (never trust client clocks for streak math).
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = (await req.json().catch(() => ({}))) as { gam?: Record<string, unknown> }
  if (!body.gam || typeof body.gam !== "object") {
    return NextResponse.json({ error: "Missing gam" }, { status: 400 })
  }
  const supabase = createServerClient()
  const { error } = await supabase
    .from("gamification")
    .upsert({ user_id: userId, ...toGamificationRow(body.gam) }, { onConflict: "user_id" })
  if (error) {
    return NextResponse.json({ error: "Failed to save gamification" }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
