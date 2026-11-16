// Content-Security-Policy construction.
//
// Extracted from middleware so the policy and the route boundary can be
// unit-tested. Two modes:
//
// - strict (nonce + 'strict-dynamic'): authenticated/app routes. They render
//   per request, so Next.js can inject the nonce into its own inline bootstrap
//   and Clerk reads `x-nonce` for its script tags.
// - legacy ('unsafe-inline'): statically prerendered public pages. They are
//   built once and served from cache; there is no per-request HTML to put a
//   nonce into, so a nonce policy would block Next's inline hydration scripts
//   and leave a blank page. They render no user data.
//
// Keeping the strict set as an allowlist of dynamic app prefixes means a new
// public page defaults to the compatible policy instead of breaking silently.
//
// `/sign-in` and `/sign-up` are the deliberate exception: they are dynamic and
// could use a nonce, but a mistake there locks every user out, so they stay on
// the compatible policy until the app routes have run with nonces in
// production. See docs/SECURITY_CSP.md.

export type CspOptions = {
  /** Per-request nonce; omit for the legacy (static page) policy. */
  nonce?: string | null
  supabaseUrl?: string
  posthogHost?: string
}

/** Routes rendered per request that must use the nonce policy. */
export const STRICT_CSP_PREFIXES = [
  "/dashboard",
  "/roadmap",
  "/start",
  "/tutor",
  "/code-e",
  "/analytics",
  "/settings",
  "/review",
  "/onboarding",
  "/auth",
] as const

/**
 * True for authenticated/app pages, which are dynamically rendered.
 * `/roadmaps` (public catalogue) is deliberately not matched by `/roadmap`.
 * API routes are excluded: JSON responses have no scripts to constrain.
 */
export function requiresStrictCsp(pathname: string): boolean {
  return STRICT_CSP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
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
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://*.clerk.com https://*.clerk.accounts.dev https://clerk.hipathai.me`
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
