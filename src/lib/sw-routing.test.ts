import { describe, expect, it } from "vitest"
import { isUncacheableApiRequest } from "./sw-routing"

describe("service worker API bypass", () => {
  it("bypasses the cache for same-origin API paths", () => {
    for (const path of [
      "/api/me/progress",
      "/api/me/roadmap",
      "/api/roadmaps/status/abc",
      "/api/chat/threads",
      "/api/lessons/content?id=1",
    ]) {
      expect(isUncacheableApiRequest(path, true), path).toBe(true)
    }
  })

  it("leaves pages and static assets cacheable", () => {
    for (const path of ["/dashboard", "/roadmap/abc", "/_next/static/chunk.js", "/apiary"]) {
      expect(isUncacheableApiRequest(path, true), path).toBe(false)
    }
  })

  it("does not try to intercept cross-origin requests", () => {
    expect(isUncacheableApiRequest("/api/me/progress", false)).toBe(false)
  })
})
