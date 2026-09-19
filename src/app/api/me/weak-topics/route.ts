import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"

// GET /api/me/weak-topics — topics the caller has failed, worst first.
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const supabase = createServerClient()
  const { data } = await supabase
    .from("weak_topics")
    .select("topic,fail_count")
    .eq("user_id", userId)
    .order("fail_count", { ascending: false })
    .limit(10)
  const topics = ((data ?? []) as { topic: string; fail_count: number | null }[]).map((r) => ({
    topic: r.topic,
    fail_count: r.fail_count ?? 1,
  }))
  return NextResponse.json({ topics })
}
