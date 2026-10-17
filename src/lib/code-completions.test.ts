import { describe, it, expect } from "vitest"
import { suggestCompletions, localSymbols } from "./code-completions"

describe("suggestCompletions", () => {
  it("suggests keywords and builtins for the language", () => {
    const labels = suggestCompletions("python", "", "pr").map((c) => c.label)
    expect(labels).toContain("print")
    const js = suggestCompletions("javascript", "", "cons").map((c) => c.label)
    expect(js).toContain("console")
    expect(suggestCompletions("java", "", "Scan").map((c) => c.label)).toContain("Scanner")
    expect(suggestCompletions("sql", "", "COUNT").map((c) => c.label)).toContain("COUNT")
  })
  it("is language-aware, never leaking another language's words", () => {
    expect(suggestCompletions("python", "", "console").map((c) => c.label)).not.toContain("console")
    expect(suggestCompletions("go", "", "fmt.").map((c) => c.label)).toContain("Println")
    // Unknown language still returns the learner's own identifiers.
    expect(suggestCompletions("brainfuck", "x = 1", "x")).toEqual([])
  })
  it("ranks the learner's own identifiers first", () => {
    const out = suggestCompletions("python", "total_count = 0\nfor item in items:\n    total_count += item", "total")
    expect(out[0]?.label).toBe("total_count")
    expect(out[0]?.kind).toBe("local")
  })
  it("returns nothing for a prefix nothing matches", () => {
    expect(suggestCompletions("python", "print(1)", "zzzz")).toEqual([])
    expect(suggestCompletions("text", "", "pr")).toEqual([])
  })
  it("returns a usable list for an empty prefix (Ctrl+Space)", () => {
    const out = suggestCompletions("python", "")
    expect(out.length).toBeGreaterThan(10)
    expect(out.some((c) => c.kind === "keyword")).toBe(true)
    expect(out.some((c) => c.kind === "function")).toBe(true)
  })
})

describe("localSymbols", () => {
  it("finds identifiers but not reserved words", () => {
    const out = localSymbols("def compute_total(items):\n    return max_total")
    const labels = out.map((c) => c.label)
    expect(labels).toContain("compute_total")
    expect(labels).toContain("max_total")
    expect(labels).not.toContain("def")
    expect(labels).not.toContain("return")
  })
  it("dedupes and caps the list", () => {
    const code = Array.from({ length: 200 }, (_, i) => `variable_name_${i} = ${i}`).join("\n")
    const out = localSymbols(code, 25)
    expect(out.length).toBeLessThanOrEqual(25)
    expect(new Set(out.map((c) => c.label)).size).toBe(out.length)
  })
})
