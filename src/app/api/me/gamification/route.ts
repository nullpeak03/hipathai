import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

// XP and progression counters are updated only by server-graded actions.
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ error: "Gamification is updated by server-graded actions." }, { status: 410 })
}
