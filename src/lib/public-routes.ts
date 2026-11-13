// Route allowlists for `src/middleware.ts`.
//
// Public routes skip authentication entirely. Every other `/api/*` path is
// default-denied, so an API route that must serve anonymous visitors has to
// be listed here — forgetting it makes the endpoint unreachable (a real
// production bug: the Pro waitlist returned 401 to every visitor).
//
// Keep this list minimal and auditable. Anything added here is reachable
// without a Clerk session.

/** Page routes and API routes that are reachable without signing in. */
export const PUBLIC_ROUTE_PATTERNS = [
  "/",
  "/privacy(.*)",
  "/terms(.*)",
  "/cookies(.*)",
  "/contact(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Clerk user-sync webhook (signature-verified inside the route).
  "/api/webhooks(.*)",
  // Inngest worker (signature-verified by the Inngest SDK).
  "/api/inngest(.*)",
  "/api/health",
  // Pro launch waitlist: signup is anonymous by design, and the confirm /
  // remove endpoints are protected by single-use 64-char tokens instead of a
  // session. All three are rate-limited inside their handlers.
  "/api/pricing/(.*)",
] as const

/**
 * Minimal matcher for the `(.*)`-suffix syntax used above.
 *
 * Mirrors the subset of Clerk's `createRouteMatcher` behaviour this project
 * relies on, without importing Clerk into the test runtime.
 */
export function matchesPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTE_PATTERNS.some((pattern) => {
    if (pattern.endsWith("(.*)")) {
      const prefix = pattern.slice(0, -"(.*)".length)
      if (prefix.endsWith("/")) return pathname.startsWith(prefix)
      return pathname === prefix || pathname.startsWith(`${prefix}/`)
    }
    return pathname === pattern
  })
}
