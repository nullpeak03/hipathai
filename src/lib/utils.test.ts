import { describe, it, expect } from "vitest"
import { cn, getErrorMessage } from "./utils"

describe("getErrorMessage", () => {
  it("extracts Error messages", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom")
  })
  it("stringifies anything else", () => {
    expect(getErrorMessage("oops")).toBe("oops")
    expect(getErrorMessage(42)).toBe("42")
    expect(getErrorMessage(null)).toBe("null")
    expect(getErrorMessage(undefined)).toBe("undefined")
  })
})

describe("cn", () => {
  it("merges classes and resolves Tailwind conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
    expect(cn("a", false && "b", "c")).toBe("a c")
    expect(cn()).toBe("")
  })
})
