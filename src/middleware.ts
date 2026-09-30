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
  // Exact + children only: "/roadmap(.*)" would also swallow the PUBLIC
  // library at /roadmaps. /start needs auth so template intent survives
  // sign-in via redirect_url.
  "/roadmap",
  "/roadmap/(.*)",
  "/start(.*)",
  "/tutor(.*)",
  "/analytics(.*)",
  "/settings(.*)",
  "/onboarding(.*)",
  "/auth/redirect(.*)",
  "/api/chat(.*)",
  "/api/roadmaps(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return
  if (isProtectedRoute(req)) {
    const { userId } = await auth()
    if (!userId) {
      if (req.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      const signInUrl = new URL("/sign-in", req.url)
      signInUrl.searchParams.set("redirect_url", req.url)
      return NextResponse.redirect(signInUrl)
    }
  }
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
