import { describe, it, expect } from "vitest"
import { parseTimeToMinutes, parseDurationToDays } from "./onboarding.config"

describe("parseTimeToMinutes", () => {
  it("parses preset labels", () => {
    expect(parseTimeToMinutes("30 min")).toBe(30)
    expect(parseTimeToMinutes("1 hr")).toBe(60)
    expect(parseTimeToMinutes("1 hr / day")).toBe(60)
    expect(parseTimeToMinutes("2 hrs")).toBe(120)
    expect(parseTimeToMinutes("2 hrs / day")).toBe(120)
  })
  it("parses raw numbers and defaults to an hour", () => {
    expect(parseTimeToMinutes("90")).toBe(90)
    expect(parseTimeToMinutes("banana")).toBe(60)
  })
})

describe("parseDurationToDays", () => {
  it("converts weeks and days", () => {
    expect(parseDurationToDays("2 weeks")).toBe(14)
    expect(parseDurationToDays("4 weeks")).toBe(28)
    expect(parseDurationToDays("8 weeks")).toBe(56)
    expect(parseDurationToDays("10 days")).toBe(10)
  })
  it("defaults to 8 weeks", () => {
    expect(parseDurationToDays("Custom")).toBe(56)
  })
})
