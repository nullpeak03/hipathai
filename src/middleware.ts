import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isPublicRoute = createRouteMatcher([
  "/",
  "/privacy(.*)",
  "/terms(.*)",
  "/cookies(.*)",
  "/contact(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/inngest(.*)",
])

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/roadmap",
  "/roadmap/(.*)",
  "/start(.*)",
  "/tutor(.*)",
  "/code-e(.*)",
  "/analytics(.*)",
  "/settings(.*)",
  "/review(.*)",
  "/onboarding(.*)",
  "/auth/redirect(.*)",
  "/api/chat(.*)",
  "/api/roadmaps(.*)",
])

function buildCsp(nonce: string): string {
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
    : ""
  const posthogOrigin = process.env.NEXT_PUBLIC_POSTHOG_HOST
    ? new URL(process.env.NEXT_PUBLIC_POSTHOG_HOST).origin
    : ""
  const connect = [
    "'self'",
    "https://clerk.hipathai.me",
    "https://*.clerk.com",
    "https://*.clerk.accounts.dev",
    "wss://*.clerk.com",
    "wss://*.clerk.accounts.dev",
    supabaseOrigin,
    supabaseOrigin ? supabaseOrigin.replace(/^https:/, "wss:") : "",
    posthogOrigin,
  ].filter(Boolean)
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://*.clerk.com https://*.clerk.accounts.dev https://clerk.hipathai.me`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://img.clerk.com https://*.supabase.co",
    "font-src 'self' data:",
    `connect-src ${[...new Set(connect)].join(" ")}`,
    "frame-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://accounts.google.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ")
}

export default clerkMiddleware(async (auth, req) => {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const csp = buildCsp(nonce)
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-nonce", nonce)

  const finalize = (res: NextResponse) => {
    res.headers.set("Content-Security-Policy", csp)
    res.headers.set("x-nonce", nonce)
    return res
  }

  if (isPublicRoute(req)) {
    return finalize(NextResponse.next({ request: { headers: requestHeaders } }))
  }
  if (isProtectedRoute(req)) {
    const { userId } = await auth()
    if (!userId) {
      if (req.nextUrl.pathname.startsWith("/api/")) {
        return finalize(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
      }
      const signInUrl = new URL("/sign-in", req.url)
      signInUrl.searchParams.set("redirect_url", req.url)
      return finalize(NextResponse.redirect(signInUrl))
    }
  }
  return finalize(NextResponse.next({ request: { headers: requestHeaders } }))
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
