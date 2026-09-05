// Supabase client for Client Components
"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient, User } from "@supabase/supabase-js"

let clerkAccessToken: string | undefined

export function setSupabaseAccessToken(token: string | undefined) {
  clerkAccessToken = token
}

function getClerkUserId() {
  if (!clerkAccessToken) return null

  try {
    const payload = clerkAccessToken.split(".")[1]
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
    return typeof decoded.sub === "string" ? decoded.sub : null
  } catch {
    return null
  }
}

function isValidSupabaseUrl(value: string | undefined): value is string {
  if (!value) return false

  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!isValidSupabaseUrl(url) || !key) {
    // Return a mock client for build-time rendering
    return {
      auth: {
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      },
      from: () => ({
        select: () => Promise.resolve({ data: [], error: null }),
        insert: () => Promise.resolve({ data: null, error: null }),
        update: () => Promise.resolve({ data: null, error: null }),
        delete: () => Promise.resolve({ data: null, error: null }),
        eq: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
        single: () => Promise.resolve({ data: null, error: null }),
      }),
      channel: () => ({
        on: () => ({ subscribe: () => {} }),
        subscribe: () => {},
      }),
    } as any
  }
  
  const client = createBrowserClient(url, key, {
    global: {
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers)
        if (clerkAccessToken) {
          headers.set("Authorization", `Bearer ${clerkAccessToken}`)
        }
        return fetch(input, { ...init, headers })
      },
      headers: clerkAccessToken
        ? { Authorization: `Bearer ${clerkAccessToken}` }
        : undefined,
    },
  })

  // Clerk tokens authenticate Supabase requests but are not stored in GoTrue.
  // Resolve the Clerk subject for existing client-page identity checks.
  const supabaseClient = client as SupabaseClient
  const originalGetUser = supabaseClient.auth.getUser.bind(supabaseClient.auth)
  supabaseClient.auth.getUser = async () => {
    const clerkUserId = getClerkUserId()
    if (clerkUserId) {
      return {
        data: {
          user: {
            id: clerkUserId,
            aud: "authenticated",
            role: "authenticated",
            email: "",
            app_metadata: {},
            user_metadata: {},
            created_at: "",
          } as User,
        },
        error: null,
      }
    }

    return originalGetUser()
  }

  return supabaseClient
}