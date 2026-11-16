// Content-Security-Policy construction.
//
// Extracted from middleware so the policy and the route boundary can be
// unit-tested. Two modes:
//
// - strict (nonce + 'strict-dynamic'): page routes that Next.js renders per
//   request. Next reads the nonce from the request CSP and stamps it on its own
//   inline bootstrap; Clerk reads `x-nonce` for its script tags.
// - compatible ('unsafe-inline'): everything else. Prerendered pages are built
//   once and served from the CDN, so their HTML has no per-request nonce and a
//   nonce policy would block hydration and leave a dead page.
//
// The strict list is matched by SEGMENTS, not by prefix, and must only contain
// routes the build marks `ƒ` (dynamic). Most of the authenticated app
// (/dashboard, /roadmap, /tutor, /settings, /review, /onboarding, /analytics,
// /code-e) is currently prerendered client shells that fetch from /api/*, so
// those pages are deliberately on the compatible policy. Adding one of them to
// this list is the exact mistake that shipped and broke /roadmap once: the
// header had a nonce and the HTML had none, so every script was blocked. The
// tests in csp.test.ts pin that boundary.
//
// To check before adding a route: `npm run build` and look for `ƒ /your-route`
// in the route table. `○` or `●` means it is prerendered — do not add it.
//
// `/sign-in` and `/sign-up` are dynamic but excluded on purpose: a mistake
// there locks every user out. See docs/SECURITY_CSP.md.

export type CspOptions = {
  /** Per-request nonce; omit for the compatible (prerendered page) policy. */
  nonce?: string | null
  supabaseUrl?: string
  posthogHost?: string
}

/**
 * Dynamically rendered page routes, as segment patterns. A literal segment
 * must match exactly; `:` marks a dynamic segment (any non-empty value).
 */
export const STRICT_CSP_ROUTES: ReadonlyArray<readonly string[]> = [
  // Lesson reader: generated content, quizzes and code output — the page with
  // the largest untrusted-content surface.
  ["roadmap", ":roadmapId", "lesson", ":lessonId"],
  // Onboarding flow (per-request personalisation).
  ["start", ":slug"],
]

function splitPath(pathname: string): string[] {
  return pathname.split("/").filter(Boolean)
}

/**
 * True when the path is one of the dynamically rendered pages above.
 * `/roadmaps` (public catalogue) never matches `/roadmap/...`.
 * API routes are excluded: JSON responses have no scripts to constrain.
 */
export function requiresStrictCsp(pathname: string): boolean {
  const segments = splitPath(pathname)
  return STRICT_CSP_ROUTES.some(
    (route) =>
      route.length === segments.length &&
      route.every((part, i) => (part.startsWith(":") ? segments[i].length > 0 : part === segments[i]))
  )
}

/** `https://project.supabase.co` → also allow the realtime websocket. */
function websocketOrigin(origin: string): string {
  return origin.startsWith("https:") ? origin.replace(/^https:/, "wss:") : ""
}

export function buildCsp({ nonce, supabaseUrl, posthogHost }: CspOptions = {}): string {
  const supabaseOrigin = safeOrigin(supabaseUrl)
  const posthogOrigin = safeOrigin(posthogHost)

  const connect = [
    "'self'",
    "https://clerk.hipathai.me",
    "https://*.clerk.com",
    "https://*.clerk.accounts.dev",
    "wss://*.clerk.com",
    "wss://*.clerk.accounts.dev",
    supabaseOrigin,
    websocketOrigin(supabaseOrigin),
    posthogOrigin,
    posthogOrigin ? websocketOrigin(posthogOrigin) : "",
  ].filter(Boolean)

  const scriptSrc = nonce
    ? // No 'strict-dynamic': it disables host allowlisting, which Clerk needs
      // because its SDK is served from the proxy host (clerk.hipathai.me) by
      // script tags Next does not manage. The nonce still covers Next's own
      // inline bootstrap; hosts still cover Clerk.
      `script-src 'self' 'nonce-${nonce}' https://*.clerk.com https://*.clerk.accounts.dev https://clerk.hipathai.me`
    : "script-src 'self' 'unsafe-inline' https://*.clerk.com https://*.clerk.accounts.dev https://clerk.hipathai.me"

  return [
    "default-src 'self'",
    scriptSrc,
    // Inline style attributes are used by Tailwind/Clerk widgets; CSS injection
    // is a far smaller surface than script execution.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://img.clerk.com https://*.supabase.co https://www.indiefounders.club",
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

/** A nonce that is safe in an HTML attribute and in a CSP directive. */
export function createNonce(): string {
  return crypto.randomUUID().replace(/-/g, "")
}

function safeOrigin(value: string | undefined): string {
  if (!value) return ""
  try {
    return new URL(value).origin
  } catch {
    return ""
  }
}
