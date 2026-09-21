import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"

// DELETE /api/me/account — irreversible account deletion.
// Deletes the Clerk user first (so a half-failed request can't lock the
// caller out), then the Supabase users row which cascades roadmaps,
// progress, chats, gamification, and preferences.
export async function DELETE() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const client = await clerkClient()
    await client.users.deleteUser(userId)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[account] Clerk user delete failed:", message.slice(0, 200))
    return NextResponse.json({ error: "Could not delete your account. Please try again." }, { status: 500 })
  }
  const supabase = createServerClient()
  const { error } = await supabase.from("users").delete().eq("clerk_id", userId)
  if (error) {
    console.error("[account] Supabase user delete failed:", error.message)
    // Clerk identity is already gone; rows are orphaned but contain no
    // active session. Surface the partial failure honestly.
    return NextResponse.json({ error: "Account removed, but some data cleanup failed. Contact support." }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
