import { createBrowserClient } from "@supabase/ssr"

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !anon && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter(Boolean)
  if (missing.length > 0) {
    throw new Error(
      `[Supabase] Missing required environment variable(s): ${missing.join(", ")}. ` +
        "Copy .env.example to .env.local and fill in your Supabase project values."
    )
  }
  return { url: url as string, anon: anon as string }
}

export function createClient() {
  const { url, anon } = getSupabaseConfig()
  return createBrowserClient(url, anon)
}
