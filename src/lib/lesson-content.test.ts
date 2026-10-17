import { describe, it, expect } from "vitest"
import {
  needsRealContent,
  buildLessonPrompt,
  splitLessonContent,
  LESSON_EXAMPLE_MARKER,
  REAL_CONTENT_MIN_CHARS,
} from "./lesson-content"

describe("needsRealContent", () => {
  it("flags missing and stub content", () => {
    expect(needsRealContent(null)).toBe(true)
    expect(needsRealContent(undefined)).toBe(true)
    expect(needsRealContent("")).toBe(true)
    expect(needsRealContent("## Setup\n\nInstall Python and run scripts.")).toBe(true)
  })
  it("accepts full lessons", () => {
    expect(needsRealContent("x".repeat(REAL_CONTENT_MIN_CHARS - 1))).toBe(true)
    expect(needsRealContent("x".repeat(REAL_CONTENT_MIN_CHARS))).toBe(false)
  })
})

describe("buildLessonPrompt", () => {
  const base = { title: "Closures", objective: "Understand closures." }
  it("embeds title, level guidance, and structure contract", () => {
    const p = buildLessonPrompt(base)
    expect(p).toContain("Closures")
    expect(p).toContain("Understand closures.")
    expect(p).toContain("no prior knowledge")
    expect(p).toContain(LESSON_EXAMPLE_MARKER)
    expect(p).toContain("Return ONLY the lesson text")
  })
  it("adapts depth to level", () => {
    expect(buildLessonPrompt({ ...base, level: "Advanced" })).toContain("edge cases")
    expect(buildLessonPrompt({ ...base, level: "Intermediate" })).toContain("basic familiarity")
  })
  it("adapts to learning style", () => {
    expect(buildLessonPrompt({ ...base, style: "Visual" })).toContain("analogies")
    expect(buildLessonPrompt({ ...base, style: "Hands-on" })).toContain("mini-exercises")
    expect(buildLessonPrompt({ ...base, style: "Theory" })).toContain("first principles")
    expect(buildLessonPrompt({ ...base, style: "Nonsense" })).toContain("Balance")
  })
  it("includes the goal when given", () => {
    expect(buildLessonPrompt({ ...base, goal: "Become a dev" })).toContain("Become a dev")
  })
})

describe("splitLessonContent", () => {
  const body = `WHAT YOU WILL LEARN:\n- Closures rock.\n${"y".repeat(700)}`
  const code = `python\nprint("hi")\nprint("bye")\nzzzzzzzzzz`
  const full = `${body}\n${LESSON_EXAMPLE_MARKER}\n${code}`
  it("splits body from example code", () => {
    const out = splitLessonContent(full)
    expect(out?.contentMd).toBe(body)
    expect(out?.exampleCode).toContain('print("hi")')
    expect(out?.exampleCode).not.toContain("python\n")
  })
  it("rejects missing markers and stubs", () => {
    expect(splitLessonContent("no marker here at all, just prose")).toBeNull()
    expect(splitLessonContent(`short\n${LESSON_EXAMPLE_MARKER}\npython\nx = 1`)).toBeNull()
    expect(splitLessonContent("")).toBeNull()
  })
})

describe("buildLessonJsonPrompt", () => {
  it("keeps calibration and demands the JSON contract", async () => {
    const { buildLessonJsonPrompt } = await import("./lesson-content")
    const p = buildLessonJsonPrompt({ title: "Closures", objective: "Understand closures.", level: "Advanced", style: "Visual", goal: "Frontend" })
    expect(p).toContain("Closures")
    expect(p).toContain("edge cases")
    expect(p).toContain("analogies")
    expect(p).toContain("Frontend")
    expect(p).toContain('"sections"')
  })
  it("confines code samples to code blocks with real line breaks", async () => {
    const { buildLessonJsonPrompt } = await import("./lesson-content")
    const p = buildLessonJsonPrompt({ title: "T", objective: "O" })
    expect(p).toContain('{"type":"code"}')
    expect(p).toContain("real line breaks")
    expect(p).toContain("never write code inside paragraph")
  })
  it("demands extended depth with graduated examples", async () => {
    const { buildLessonJsonPrompt } = await import("./lesson-content")
    const p = buildLessonJsonPrompt({ title: "T", objective: "O" })
    expect(p).toContain("10-minute")
    expect(p).toContain("2-3 graduated")
    expect(p).toContain("when NOT to use it")
    expect(p).toContain("3-4 exercises")
    expect(p).toContain("real-world use case")
  })
  it("adapts depth guidance per level", async () => {
    const { buildLessonJsonPrompt } = await import("./lesson-content")
    expect(buildLessonJsonPrompt({ title: "T", objective: "O", level: "Beginner" })).toContain("vivid real-world analogy")
    expect(buildLessonJsonPrompt({ title: "T", objective: "O", level: "Intermediate" })).toContain("trade-offs")
    expect(buildLessonJsonPrompt({ title: "T", objective: "O", level: "Advanced" })).toContain("internals")
  })
})

describe("buildLessonPartPrompt", () => {
  it("splits the lesson into four bounded parts with the JSON contract", async () => {
    const { buildLessonPartPrompt } = await import("./lesson-content")
    const input = { title: "Closures", objective: "Understand closures.", level: "Advanced" }
    const a = buildLessonPartPrompt(input, "foundation")
    expect(a).toContain("PART 1 of 4")
    expect(a).toContain("Closures")
    expect(a).toContain("internals")
    expect(a).toContain("Do NOT write further code examples")
    expect(a).toContain('"sections"')
    const b = buildLessonPartPrompt({ ...input, level: "Beginner" }, "practice")
    expect(b).toContain("PART 4 of 4")
    expect(b).toContain("PRACTICE SET")
    expect(b).toContain('"sections"')
  })
  it("gives each part its own bounded scope", async () => {
    const { buildLessonPartPrompt } = await import("./lesson-content")
    const input = { title: "T", objective: "O" }
    const examples = buildLessonPartPrompt(input, "examples")
    expect(examples).toContain("PART 2 of 4")
    expect(examples).toContain("2 graduated runnable code examples")
    const context = buildLessonPartPrompt(input, "context")
    expect(context).toContain("PART 3 of 4")
    expect(context).toContain("real-world use case")
    expect(context).toContain("common mistakes")
    // No part may ask for the whole lesson (that is what blew the step budget).
    for (const kind of ["foundation", "examples", "context", "practice"] as const) {
      const p = buildLessonPartPrompt(input, kind)
      expect(p).toContain("Cover ONLY this part")
      expect(p).toContain("of 4 (")
    }
  })
  it("continues from earlier part headings instead of repeating", async () => {
    const { buildLessonPartPrompt } = await import("./lesson-content")
    const plain = buildLessonPartPrompt({ title: "T", objective: "O" }, "practice")
    expect(plain).not.toContain("already covered")
    const cont = buildLessonPartPrompt({ title: "T", objective: "O" }, "practice", ["What Closures Are"])
    expect(cont).toContain("already covered")
    expect(cont).toContain("What Closures Are")
    expect(cont).toContain("do NOT repeat")
  })
})

describe("style blending", () => {
  it("blends multiple styles in lesson prompts", async () => {
    const { buildLessonPrompt } = await import("./lesson-content")
    const p = buildLessonPrompt({ title: "T", objective: "O", style: "Visual, Hands-on" })
    expect(p).toContain("analogies")
    expect(p).toContain("mini-exercises")
  })
  it("accepts arrays and falls back to Mixed", async () => {
    const { buildLessonJsonPrompt } = await import("./lesson-content")
    const arr = buildLessonJsonPrompt({ title: "T", objective: "O", style: ["Socratic", "Bogus"] })
    expect(arr).toContain("probing questions")
    expect(arr).not.toContain("Bogus")
    const fallback = buildLessonJsonPrompt({ title: "T", objective: "O", style: "Bogus" })
    expect(fallback).toContain("Balance explanation")
  })
})
