import { describe, it, expect } from "vitest"
import { ringGeometry } from "./ring"

describe("ringGeometry", () => {
  it("maps 0/50/100 to full/half/zero offset", () => {
    const c = 2 * Math.PI * 10
    expect(ringGeometry(10, 0).offset).toBeCloseTo(c)
    expect(ringGeometry(10, 50).offset).toBeCloseTo(c / 2)
    expect(ringGeometry(10, 100).offset).toBeCloseTo(0)
  })
  it("clamps out-of-range input", () => {
    expect(ringGeometry(10, -5).offset).toBeCloseTo(2 * Math.PI * 10)
    expect(ringGeometry(10, 140).offset).toBeCloseTo(0)
  })
})
