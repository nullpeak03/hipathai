import { createClient as createSupabaseClient } from "@supabase/supabase-js"

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || (process.env as any).DATABASE_URL || "https://yzqflukqyfvnvgbbrxff.supabase.co"
  // Use SERVICE_ROLE key for server-side operations (bypasses RLS)
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || (process.env as any).SERVICE_ROLE || ""
  return { url, serviceRole }
}

export function createServerClient() {
  const { url, serviceRole } = getSupabaseConfig()
  if (!url || !serviceRole || url.includes("undefined") || serviceRole.length < 20) {
    console.warn("Supabase service role not configured — falling back to mock client")
    return {
      from: () => ({ insert: async () => ({ data: null, error: null }), select: () => ({ data: null, error: null }), upsert: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }) }),
      auth: { getUser: async () => ({ data: { user: null } }) }
    } as any
  }
  return createSupabaseClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}