import { describe, expect, it } from "vitest"
import { buildCsp, createNonce, requiresStrictCsp, STRICT_CSP_ROUTES } from "./csp"

const directive = (csp: string, name: string) =>
  csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `)) ?? ""

describe("buildCsp", () => {
  it("uses the nonce and drops unsafe-inline for scripts in strict mode", () => {
    const csp = buildCsp({ nonce: "abc123" })
    const scriptSrc = directive(csp, "script-src")
    expect(scriptSrc).toContain("'nonce-abc123'")
    expect(scriptSrc).not.toContain("'unsafe-inline'")
    // 'strict-dynamic' disables host allowlisting, which Clerk needs for its
    // proxy-hosted SDK.
    expect(scriptSrc).not.toContain("'strict-dynamic'")
    expect(scriptSrc).toContain("https://clerk.hipathai.me")
  })

  it("keeps unsafe-inline for scripts on prerendered pages", () => {
    const csp = buildCsp({ nonce: null })
    const scriptSrc = directive(csp, "script-src")
    expect(scriptSrc).toContain("'unsafe-inline'")
    expect(scriptSrc).not.toContain("'nonce-")
  })

  it("keeps unsafe-inline for styles in both modes (Tailwind + Clerk)", () => {
    expect(directive(buildCsp({ nonce: "n" }), "style-src")).toContain("'unsafe-inline'")
    expect(directive(buildCsp({}), "style-src")).toContain("'unsafe-inline'")
  })

  it("allows the Supabase REST and realtime origins", () => {
    const csp = buildCsp({ supabaseUrl: "https://abc.supabase.co" })
    const connect = directive(csp, "connect-src")
    expect(connect).toContain("https://abc.supabase.co")
    expect(connect).toContain("wss://abc.supabase.co")
  })

  it("allows the PostHog origin when configured", () => {
    const connect = directive(buildCsp({ posthogHost: "https://eu.i.posthog.com" }), "connect-src")
    expect(connect).toContain("https://eu.i.posthog.com")
  })

  it("does not emit empty tokens or duplicate origins", () => {
    const csp = buildCsp({ supabaseUrl: "not a url", posthogHost: "" })
    const connect = directive(csp, "connect-src")
    expect(connect).not.toMatch(/\s{2,}/)
    expect(connect).not.toContain("  ")
    const origins = connect.replace("connect-src ", "").split(" ")
    expect(new Set(origins).size).toBe(origins.length)
  })

  it("keeps the lockdown directives", () => {
    const csp = buildCsp({ nonce: "n" })
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("frame-ancestors 'self'")
    expect(csp).toContain("default-src 'self'")
  })
})

describe("requiresStrictCsp", () => {
  it("covers the dynamically rendered page routes", () => {
    for (const path of [
      "/roadmap/abc/lesson/def",
      "/roadmap/387eaa82-7e3f-46fe-a911-98d4766e7d86/lesson/ef2b6bb5",
      "/start/python-basics",
      "/start/python-basics/",
    ]) {
      expect(requiresStrictCsp(path), path).toBe(true)
    }
  })

  // Regression guard: these are prerendered (`○` in the build route table).
  // A nonce policy here means the header carries a nonce and the HTML does
  // not, so every script tag is blocked and the page stops hydrating.
  it("never captures prerendered app pages", () => {
    for (const path of [
      "/dashboard",
      "/roadmap",
      "/tutor",
      "/settings",
      "/review",
      "/onboarding",
      "/analytics",
      "/code-e",
      "/roadmap/abc",
      "/roadmap/abc/lesson/def/extra",
      "/dashboard/anything",
    ]) {
      expect(requiresStrictCsp(path), path).toBe(false)
    }
  })

  it("does not capture public, auth or api routes", () => {
    for (const path of [
      "/",
      "/pricing",
      "/roadmaps",
      "/roadmaps/python-basics",
      "/product-roadmap",
      "/privacy",
      "/sign-in",
      "/sign-in/sso-callback",
      "/sign-up",
      "/auth/redirect",
      "/api/chat",
      "/api/roadmaps/status/abc",
    ]) {
      expect(requiresStrictCsp(path), path).toBe(false)
    }
  })

  it("keeps the list to known dynamic routes only", () => {
    expect(STRICT_CSP_ROUTES.map((route) => route.join("/"))).toEqual([
      "roadmap/:roadmapId/lesson/:lessonId",
      "start/:slug",
    ])
  })
})

describe("createNonce", () => {
  it("is long, hex-only and unique per call", () => {
    const a = createNonce()
    const b = createNonce()
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(a).not.toBe(b)
  })
})
