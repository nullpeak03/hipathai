import { createClient as createSupabaseClient } from "@supabase/supabase-js"

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Server-side operations use the service-role key (bypasses RLS).
  // NEVER expose this key with a NEXT_PUBLIC_ prefix.
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !serviceRole && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean)
  if (missing.length > 0) {
    throw new Error(
      `[Supabase] Missing required environment variable(s): ${missing.join(", ")}. ` +
        "Copy .env.example to .env.local and fill in your Supabase project values."
    )
  }
  return { url: url as string, serviceRole: serviceRole as string }
}

export function createServerClient() {
  const { url, serviceRole } = getSupabaseConfig()
  return createSupabaseClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}
