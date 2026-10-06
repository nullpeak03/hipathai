import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"

// GET /api/me/entitlement — { pro } for paywalled features (code runner).
// Unsigned users and missing rows read as free; never errors the client.
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ pro: false })
  }
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from("users")
      .select("is_pro")
      .eq("clerk_id", userId)
      .single()
    return NextResponse.json({ pro: (data as { is_pro?: boolean } | null)?.is_pro === true })
  } catch {
    return NextResponse.json({ pro: false })
  }
}
