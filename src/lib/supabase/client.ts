import { createBrowserClient } from "@supabase/ssr"

function getSupabaseConfig() {
  // support multiple .env naming variants (.env currently has DATABASE_URL / malformed key)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || (process.env as any).DATABASE_URL || "https://yzqflukqyfvnvgbbrxff.supabase.co"
  // anon key may be under NEXT_PUBLIC_SUPABASE_ANON_KEY or malformed NEXT_PUBLIC_SUPABASE_URL/ANON or SERVICE_ROLE fallback
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (process.env as any)["NEXT_PUBLIC_SUPABASE_URL/ANON"] || (process.env as any).SERVICE_ROLE || ""
  return { url, anon }
}

export function createClient() {
  const { url, anon } = getSupabaseConfig()
  return createBrowserClient(url, anon)
}
