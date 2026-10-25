import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from("learner_mastery")
    .select("id,user_id,roadmap_id,lesson_id,topic,mastery_score,attempts,last_practiced_at,decay_rate,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
  if (error) return NextResponse.json({ error: "Failed to load mastery" }, { status: 500 })
  return NextResponse.json({ mastery: data ?? [] })
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ error: "Mastery is updated by server-graded assessments." }, { status: 410 })
}
