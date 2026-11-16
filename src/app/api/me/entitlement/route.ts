import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { isUnlimitedUser } from "@/lib/unlimited"

// GET /api/me/entitlement — { pro, reviewer }.
// `pro` drives paywalled features (code runner); `reviewer` says whether this
// account may open the roadmap review queue. The flag exists so the sidebar
// can hide /review without probing an admin-only endpoint and logging a 403
// for every learner on every page load.
// Unsigned users and missing rows read as free; never errors the client.
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ pro: false, reviewer: false })
  }
  if (await isUnlimitedUser(userId)) {
    return NextResponse.json({ pro: true, reviewer: true })
  }
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from("users")
      .select("is_pro")
      .eq("clerk_id", userId)
      .single()
    return NextResponse.json({
      pro: (data as { is_pro?: boolean } | null)?.is_pro === true,
      reviewer: false,
    })
  } catch {
    return NextResponse.json({ pro: false, reviewer: false })
  }
}
