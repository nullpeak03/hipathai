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
