import { describe, it, expect } from "vitest"
import { getAiUsageEvents } from "./ai-service"

describe("ai service", () => {
  it("exposes usage events", () => {
    expect(Array.isArray(getAiUsageEvents())).toBe(true)
  })
})
