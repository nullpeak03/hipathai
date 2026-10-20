import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const supabase = createServerClient()
  const { data, error } = await supabase.from("learner_mastery").select("topic,mastery_score").eq("user_id", userId)
  if (error) return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 })
  const rows = data ?? []
  const total = rows.length
  const average = total ? Math.round(rows.reduce((sum, r) => sum + Number(r.mastery_score), 0) / total) : 0
  const mastered = rows.filter((r) => Number(r.mastery_score) >= 90).length
  const lowMastery = rows.filter((r) => Number(r.mastery_score) < 90).map((r) => r.topic).slice(0, 8)
  return NextResponse.json({ total, average, mastered, lowMastery })
}
