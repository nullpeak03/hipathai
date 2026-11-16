import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { matchesPublicRoute } from "@/lib/public-routes"
import { buildCsp, createNonce, requiresStrictCsp } from "@/lib/csp"

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

export default clerkMiddleware(async (auth, req) => {
  // Only per-request rendered pages get a nonce: Next.js stamps it on its own
  // scripts and Clerk reads it from `x-nonce`. Everything prerendered keeps the
  // compatible policy, because its HTML has no nonce to match (see
  // src/lib/csp.ts — most of the app is prerendered, so the list is small).
  const strict = requiresStrictCsp(req.nextUrl.pathname)
  const nonce = strict ? createNonce() : null
  const csp = buildCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  })
  const requestHeaders = new Headers(req.headers)
  // Next.js reads the CSP from the *request* headers to inject the nonce;
  // Clerk reads `x-nonce` directly.
  requestHeaders.set("Content-Security-Policy", csp)
  if (nonce) requestHeaders.set("x-nonce", nonce)

  const finalize = (res: NextResponse) => {
    res.headers.set("Content-Security-Policy", csp)
    return res
  }

  if (matchesPublicRoute(req.nextUrl.pathname)) {
    return finalize(NextResponse.next({ request: { headers: requestHeaders } }))
  }
  // Default-deny for all API routes (except public ones).
  if (req.nextUrl.pathname.startsWith("/api/") && !matchesPublicRoute(req.nextUrl.pathname)) {
    const { userId } = await auth()
    if (!userId) {
      return finalize(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
    }
  }
  if (isProtectedRoute(req) && !req.nextUrl.pathname.startsWith("/api/")) {
    const { userId } = await auth()
    if (!userId) {
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
