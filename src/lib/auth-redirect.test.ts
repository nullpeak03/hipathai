import { describe, it, expect } from "vitest"
import { postAuthTarget, isExplicitOnboardingIntent } from "./auth-redirect"

describe("postAuthTarget", () => {
  it("sends roadmap owners to the dashboard", () => {
    expect(postAuthTarget(true)).toBe("/dashboard")
  })
  it("sends fresh users to onboarding", () => {
    expect(postAuthTarget(false)).toBe("/onboarding")
  })
})

describe("isExplicitOnboardingIntent", () => {
  it("honors edit and fresh-start params", () => {
    expect(isExplicitOnboardingIntent("abc-123", null)).toBe(true)
    expect(isExplicitOnboardingIntent(null, "1")).toBe(true)
    expect(isExplicitOnboardingIntent("abc-123", "1")).toBe(true)
  })
  it("treats plain visits as guardable", () => {
    expect(isExplicitOnboardingIntent(null, null)).toBe(false)
    expect(isExplicitOnboardingIntent(null, "0")).toBe(false)
    expect(isExplicitOnboardingIntent("", "")).toBe(false)
  })
})
