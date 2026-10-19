import { createServerClient } from "./supabase/server"

const UNLIMITED_EMAIL = "hirdenacharya03@gmail.com"

let cachedClerkId: string | null | undefined

export async function getUnlimitedClerkId(): Promise<string | null> {
  if (cachedClerkId !== undefined) return cachedClerkId
  try {
    const supabase = createServerClient()
    const { data } = await supabase.from("users").select("clerk_id").eq("email", UNLIMITED_EMAIL).single()
    cachedClerkId = (data as { clerk_id?: string } | null)?.clerk_id ?? null
  } catch {
    cachedClerkId = null
  }
  return cachedClerkId
}

export async function isUnlimitedUser(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  const unlimitedId = await getUnlimitedClerkId()
  return unlimitedId === userId
}
