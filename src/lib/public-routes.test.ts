import { describe, expect, it } from "vitest"
import { PUBLIC_ROUTE_PATTERNS, matchesPublicRoute } from "./public-routes"

describe("public route allowlist", () => {
  it("keeps the anonymous Pro waitlist reachable", () => {
    // Regression: middleware default-denies /api/*, so these returned 401
    // to every visitor and the waitlist collected nothing.
    expect(matchesPublicRoute("/api/pricing/waitlist")).toBe(true)
    expect(matchesPublicRoute("/api/pricing/waitlist/confirm")).toBe(true)
    expect(matchesPublicRoute("/api/pricing/waitlist/remove")).toBe(true)
  })

  it("keeps the existing public endpoints public", () => {
    for (const path of [
      "/",
      "/privacy",
      "/terms",
      "/cookies",
      "/contact",
      "/sign-in",
      "/sign-in/factor-one",
      "/sign-up",
      "/api/health",
      "/api/inngest",
      "/api/webhooks/clerk",
    ]) {
      expect(matchesPublicRoute(path), path).toBe(true)
    }
  })

  it("default-denies user and AI API routes", () => {
    for (const path of [
      "/api/chat",
      "/api/chat/threads",
      "/api/roadmaps",
      "/api/roadmaps/async",
      "/api/lessons/content",
      "/api/me/account",
      "/api/me/review-queue",
      "/api/upload/image",
      "/api/code/run",
    ]) {
      expect(matchesPublicRoute(path), path).toBe(false)
    }
  })

  it("does not treat a lookalike prefix as public", () => {
    expect(matchesPublicRoute("/api/pricing-evil")).toBe(false)
    expect(matchesPublicRoute("/privacy-policy")).toBe(false)
    expect(matchesPublicRoute("/api/healthz")).toBe(false)
  })

  it("lists pricing exactly once and only as a subtree", () => {
    const pricing = PUBLIC_ROUTE_PATTERNS.filter((p) => p.includes("pricing"))
    expect(pricing).toEqual(["/api/pricing/(.*)"])
  })
})
