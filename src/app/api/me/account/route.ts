import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { deleteTutorImagesForUser } from "@/lib/tutor-image-cleanup"

// DELETE /api/me/account — irreversible account deletion.
//
// Order matters:
//   1. Remove uploaded images (retryable while the account still exists).
//   2. Delete the Clerk user (identity gone first, so a later failure cannot
//      leave an account that half-exists).
//   3. Delete the Supabase users row, which cascades roadmaps, progress,
//      chats, gamification, and preferences.
export async function DELETE() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // The browser uploads straight to Storage, so these objects are not covered
  // by any database cascade. Delete them before anything irreversible.
  const supabase = createServerClient()
  const images = await deleteTutorImagesForUser(supabase.storage, userId)
  if (!images.ok) {
    console.error("[account] tutor image cleanup failed:", images.error?.slice(0, 200))
    return NextResponse.json(
      { error: "Could not remove your uploaded images. Please try again, or contact support." },
      { status: 500 }
    )
  }

  try {
    const client = await clerkClient()
    await client.users.deleteUser(userId)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[account] Clerk user delete failed:", message.slice(0, 200))
    return NextResponse.json({ error: "Could not delete your account. Please try again." }, { status: 500 })
  }

  const { error } = await supabase.from("users").delete().eq("clerk_id", userId)
  if (error) {
    console.error("[account] Supabase user delete failed:", error.message)
    // Clerk identity is already gone; rows are orphaned but contain no
    // active session. Surface the partial failure honestly.
    return NextResponse.json({ error: "Account removed, but some data cleanup failed. Contact support." }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
