import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { createServerClient } from "@/lib/supabase/server"
import { postAuthTarget } from "@/lib/auth-redirect"

/**
 * Post-auth gate: Clerk lands here after sign-in/sign-up. Existence is
 * checked server-side (localStorage may be empty on a new device) —
 * roadmap owners go to the dashboard, everyone else to onboarding.
 */
export default async function AuthRedirect() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")
  const supabase = createServerClient()
  const { data } = await supabase
    .from("roadmaps")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()
  redirect(postAuthTarget(!!data))
}
