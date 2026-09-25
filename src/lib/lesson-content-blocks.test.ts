import { describe, it, expect } from "vitest"
import {
  normalizeLessonContent,
  parseLessonContent,
  flattenLessonContent,
  isLessonContent,
  lessonQualityScore,
  LESSON_JSON_CONTRACT,
} from "./lesson-content-blocks"

const validDoc = {
  sections: [
    { type: "objectives", items: ["Understand X", "Apply Y"] },
    { type: "heading", text: "Core Ideas" },
    { type: "paragraph", text: "Some explanation here." },
    { type: "bullets", items: ["a", "b"] },
    { type: "code", language: "python", code: "print('hi')" },
    { type: "callout", kind: "tip", text: "Remember this." },
    { type: "exercise", prompt: "Try it.", solution: "Done." },
    { type: "recap", items: ["X", "Y"] },
  ],
}

describe("normalizeLessonContent", () => {
  it("accepts a well-formed document", () => {
    const out = normalizeLessonContent(validDoc)
    expect(out?.sections).toHaveLength(8)
    expect(out?.sections[4]).toMatchObject({ type: "code", language: "python" })
  })
  it("drops unknown and malformed blocks", () => {
    const out = normalizeLessonContent({
      sections: [
        { type: "mystery", text: "???" },
        { type: "paragraph", text: "   " },
        { type: "code", language: "python" },
        { type: "paragraph", text: "Keep me." },
      ],
    })
    expect(out?.sections.map((b) => b.type)).toEqual(["paragraph"])
  })
  it("defaults callout kind and code language", () => {
    const out = normalizeLessonContent({
      sections: [
        { type: "callout", kind: "bogus", text: "Hey." },
        { type: "code", code: "x = 1" },
      ],
    })
    expect(out?.sections[0]).toMatchObject({ type: "callout", kind: "tip" })
    expect(out?.sections[1]).toMatchObject({ type: "code", language: "text" })
  })
  it("rejects empty, non-object, and heading-only documents", () => {
    expect(normalizeLessonContent(null)).toBeNull()
    expect(normalizeLessonContent("nope")).toBeNull()
    expect(normalizeLessonContent({ sections: [] })).toBeNull()
    expect(normalizeLessonContent({ sections: [{ type: "heading", text: "Only" }] })).toBeNull()
  })
  it("caps runaway sizes", () => {
    const big = {
      sections: Array.from({ length: 100 }, (_, i) => ({ type: "paragraph", text: `P${i} ${"x".repeat(5000)}` })),
    }
    const out = normalizeLessonContent(big)
    expect(out?.sections.length).toBeLessThanOrEqual(40)
    expect(out?.sections[0]).toMatchObject({ type: "paragraph" })
    if (out) {
      for (const b of out.sections) {
        if (b.type === "paragraph") expect(b.text.length).toBeLessThanOrEqual(2000)
      }
    }
  })
})

describe("parseLessonContent", () => {
  it("extracts JSON wrapped in fences and chatter", () => {
    const raw = `Here's your lesson:\n\`\`\`json\n${JSON.stringify(validDoc)}\n\`\`\`\nEnjoy!`
    const out = parseLessonContent(raw)
    expect(out?.sections).toHaveLength(8)
  })
  it("returns null for unparseable output", () => {
    expect(parseLessonContent("just prose, no json at all")).toBeNull()
    expect(parseLessonContent("")).toBeNull()
  })
})

describe("flattenLessonContent", () => {
  it("renders every block kind as text", () => {
    const doc = normalizeLessonContent(validDoc)
    expect(doc).not.toBeNull()
    if (!doc) return
    const text = flattenLessonContent(doc)
    expect(text).toContain("Objectives: Understand X; Apply Y")
    expect(text).toContain("## Core Ideas")
    expect(text).toContain("- a")
    expect(text).toContain("print('hi')")
    expect(text).toContain("TIP:")
    expect(text).toContain("Exercise: Try it.")
    expect(text).toContain("Recap: X; Y")
  })
})

describe("isLessonContent", () => {
  it("type-guards rows", () => {
    expect(isLessonContent(validDoc)).toBe(true)
    expect(isLessonContent({ sections: [] })).toBe(false)
    expect(isLessonContent(null)).toBe(false)
  })
})

describe("LESSON_JSON_CONTRACT", () => {
  it("names every block type", () => {
    for (const t of ["objectives", "heading", "paragraph", "bullets", "code", "callout", "exercise", "recap"]) {
      expect(LESSON_JSON_CONTRACT).toContain(`"${t}"`)
    }
  })
})

describe("code newlines", () => {
  it("preserves multi-line code instead of paragraph-flattening", () => {
    const out = normalizeLessonContent({
      sections: [{ type: "code", language: "python", code: "def greet(name):\n    return f\"Hi {name}\"\n\nprint(greet(\"Al\"))" }],
    })
    const code = out?.sections[0]
    expect(code?.type).toBe("code")
    if (code?.type === "code") {
      expect(code.code).toContain("\n")
      expect(code.code).toBe("def greet(name):\n    return f\"Hi {name}\"\n\nprint(greet(\"Al\"))")
    }
  })
  it("normalizes CRLF and trims blank edges in code", () => {
    const out = normalizeLessonContent({
      sections: [{ type: "code", code: "\r\nx = 1  \r\ny = 2\r\n\r\n\r\nz = 3\r\n" }],
    })
    const code = out?.sections[0]
    if (code?.type === "code") expect(code.code).toBe("x = 1\ny = 2\n\nz = 3")
    else expect.unreachable()
  })
  it("keeps exercise solutions multi-line", () => {
    const out = normalizeLessonContent({
      sections: [{ type: "exercise", prompt: "Do it.", solution: "x = 1\ny = x + 2" }],
    })
    const ex = out?.sections[0]
    if (ex?.type === "exercise") expect(ex.solution).toContain("\n")
    else expect.unreachable()
  })
})

describe("fence extraction", () => {
  it("splits fenced spans out of paragraphs into code blocks", () => {
    const out = normalizeLessonContent({
      sections: [{
        type: "paragraph",
        text: "Here is how:\n```python\nx = 5\nprint(x)\n```\nThat prints five.",
      }],
    })
    expect(out?.sections.map((b) => b.type)).toEqual(["paragraph", "code"])
    const code = out?.sections[1]
    if (code?.type === "code") {
      expect(code.language).toBe("python")
      expect(code.code).toBe("x = 5\nprint(x)")
    } else expect.unreachable()
    const para = out?.sections[0]
    if (para?.type === "paragraph") expect(para.text).not.toContain("```")
    else expect.unreachable()
  })
  it("drops empty paragraphs but keeps extracted code", () => {
    const out = normalizeLessonContent({
      sections: [{ type: "paragraph", text: "```\nx = 1\n```" }],
    })
    expect(out?.sections.map((b) => b.type)).toEqual(["code"])
  })
})

describe("lessonQualityScore code signals", () => {
  const base = {
    sections: [
      { type: "objectives", items: ["A"] },
      { type: "heading", text: "H" },
      { type: "paragraph", text: "P" },
      { type: "code", language: "python", code: "x = 1" },
      { type: "exercise", prompt: "E" },
      { type: "recap", items: ["R"] },
    ],
  }
  it("rewards multi-line code over single-line", () => {
    const single = lessonQualityScore(normalizeLessonContent(base)!)
    const multi = lessonQualityScore(normalizeLessonContent({
      sections: base.sections.map((s) =>
        s.type === "code" ? { ...s, code: "x = 1\ny = 2" } : s
      ),
    })!)
    expect(multi).toBeGreaterThan(single)
  })
  it("penalizes fence remnants left in prose", () => {
    const clean = lessonQualityScore(normalizeLessonContent(base)!)
    // Unclosed fence survives extraction (needs a closing fence) → penalty.
    const dirty = lessonQualityScore({
      sections: [...normalizeLessonContent(base)!.sections, { type: "paragraph" as const, text: "leftover ``` fence" }],
    })
    expect(dirty).toBeLessThan(clean)
  })
})
