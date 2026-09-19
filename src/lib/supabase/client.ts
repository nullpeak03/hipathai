import { createBrowserClient } from "@supabase/ssr"
import { isHttpUrl } from "./validate"

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
  if (!isHttpUrl(url)) {
    throw new Error(
      "[Supabase] NEXT_PUBLIC_SUPABASE_URL is not a valid URL. " +
        "It must look like https://xyz.supabase.co — check Vercel env / .env.local for a wrongly pasted value."
    )
  }
  return { url: url as string, anon: anon as string }
}

export function createClient() {
  const { url, anon } = getSupabaseConfig()
  return createBrowserClient(url, anon)
}
