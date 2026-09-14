import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || (process.env as any).DATABASE_URL || "https://yzqflukqyfvnvgbbrxff.supabase.co"
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (process.env as any)["NEXT_PUBLIC_SUPABASE_URL/ANON"] || ""
  return { url, anon }
}

export async function createClient() {
  const cookieStore = await cookies()
  const { url, anon } = getSupabaseConfig()
  return createServerClient(url, anon, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) { try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} },
    },
  })
}
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || (process.env as any).DATABASE_URL || ""
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env as any).SERVICE_ROLE || ""
  // dynamic import to avoid bundling
  const { createClient: create } = require("@supabase/supabase-js")
  return create(url, service)
}
