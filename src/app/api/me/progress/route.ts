import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

// Progress is updated only by the transactional assessment submission RPC.
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ error: "Submit a server-issued assessment instead." }, { status: 410 })
}
