import { describe, it, expect } from "vitest"
import { normalizeRoadmapJson, extractJsonObject, repairTitle } from "./roadmap-normalize"

const meta = { goal: "Python", level: "Beginner", duration: "8 weeks" }

// Exact requested schema
const exact = {
  title: "Python Roadmap",
  description: "Learn Python",
  phases: [{
    title: "Basics",
    lessons: [{ title: "Setup", objective: "Install Python." }],
  }],
}

// Real model output observed 2026-09-19: no title/description, extra keys
const deviant = {
  goal: "Python",
  level: "Beginner",
  time_per_day: "1hr",
  duration_weeks: 8,
  total_lessons: 2,
  phases: [
    { phase: 1, title: "Foundations", lessons: [{ title: "Setup and Hello World", objective: "Install Python, run scripts." }] },
    { phase: 2, title: "Next", lessons: [{ title: "Variables", description: "Learn variables." }] },
  ],
}

describe("normalizeRoadmapJson", () => {
  it("passes exact-schema payloads through", () => {
    const out = normalizeRoadmapJson(exact, meta)
    expect(out).toMatchObject({ title: "Python Roadmap", description: "Learn Python" })
    const [phase] = out?.phases ?? []
    expect(out?.phases).toHaveLength(1)
    const [lesson] = phase?.lessons ?? []
    expect(lesson).toMatchObject({ title: "Setup", objective: "Install Python." })
  })
  it("repairs the observed deviant schema", () => {
    const out = normalizeRoadmapJson(deviant, meta)
    expect(out?.title).toBe("Roadmap for Python")
    expect(out?.description).toContain("8 weeks")
    const phases = out?.phases ?? []
    expect(phases).toHaveLength(2)
    // description accepted as objective alias
    const [, second] = phases
    const [secondLesson] = second?.lessons ?? []
    expect(secondLesson?.objective).toBe("Learn variables.")
  })
  it("returns null when nothing usable exists", () => {
    expect(normalizeRoadmapJson(null, meta)).toBeNull()
    expect(normalizeRoadmapJson("nope", meta)).toBeNull()
    expect(normalizeRoadmapJson([], meta)).toBeNull()
    expect(normalizeRoadmapJson({}, meta)).toBeNull()
    expect(normalizeRoadmapJson({ title: "T", phases: [] }, meta)).toBeNull()
    expect(normalizeRoadmapJson({ phases: [{ title: "P", lessons: [] }] }, meta)).toBeNull()
    expect(normalizeRoadmapJson({ phases: [{ lessons: [{ objective: "no title" }] }] }, meta)).toBeNull()
  })
  it("skips untitled lessons and defaults untitled phases", () => {
    const out = normalizeRoadmapJson({
      phases: [{ lessons: [{ title: "  " }, { title: "Real", objective: "Yes." }] }],
    }, meta)
    const [onlyPhase] = out?.phases ?? []
    expect(onlyPhase?.title).toBe("Phase 1")
    expect(onlyPhase?.lessons?.map((l) => l.title)).toEqual(["Real"])
  })
  it("preserves valid embedded quizzes", () => {
    const quiz = [{ q: "Q?", options: ["a", "b", "c", "d"], correct: 1, explanation: "E." }]
    const out = normalizeRoadmapJson({
      title: "T",
      phases: [{ title: "P", lessons: [{ title: "L", objective: "O", quiz }] }],
    }, meta)
    const [quizPhase] = out?.phases ?? []
    const [quizLesson] = quizPhase?.lessons ?? []
    expect(quizLesson?.quiz).toEqual(quiz)
  })
  it("drops invalid embedded quizzes instead of failing", () => {
    const out = normalizeRoadmapJson({
      title: "T",
      phases: [{ title: "P", lessons: [{ title: "L", objective: "O", quiz: [{ nope: 1 }] }] }],
    }, meta)
    const [badPhase] = out?.phases ?? []
    const [badLesson] = badPhase?.lessons ?? []
    expect(badLesson?.quiz).toBeUndefined()
  })
})

describe("extractJsonObject", () => {
  const doc = '{"title":"R","phases":[{"title":"P","lessons":[{"title":"L"}]}]}'
  it("passes clean JSON through", () => {
    expect(extractJsonObject(doc, ["phases"])).toBe(doc)
  })
  it("strips fences, thinking traces, and trailing chatter", () => {
    const wrapped = `Here's a thinking process:\nI will build a roadmap.\n\`\`\`json\n${doc}\n\`\`\`\nHope this helps!`
    expect(extractJsonObject(wrapped, ["phases"])).toBe(doc)
  })
  it("rejects fragments without the required array keys", () => {
    const fragment = '{"title":"Lesson 8: Review","objective":"Practice.","idx":4}]}]}'
    expect(extractJsonObject(fragment, ["phases", "questions", "lessons"])).toBeNull()
  })
  it("ignores braces inside strings", () => {
    const tricky = `prefix {"q":"is {x} ok?","options":["a}","b"],"correct":0,"explanation":"E."} suffix`
    const out = extractJsonObject(tricky, ["questions"])
    expect(out).toBeNull() // no "questions" key — must not match garbage
    const withKey = `prefix {"questions":[{"q":"is {x} ok?"}]} suffix`
    expect(extractJsonObject(withKey, ["questions"])).toContain("{x}")
  })
  it("returns null for unbalanced or empty input", () => {
    expect(extractJsonObject('{"a":1', ["phases"])).toBeNull()
    expect(extractJsonObject("", ["phases"])).toBeNull()
    expect(extractJsonObject("no braces here", [])).toBeNull()
  })
  it("picks the largest valid span", () => {
    const small = '{"title":"S"}'
    const combined = `${small} and then ${doc}`
    expect(extractJsonObject(combined, ["phases"])).toBe(doc)
  })
})

describe("repairTitle", () => {
  it("strips numbered suffixes seen live in prod", () => {
    expect(repairTitle("Python Foundations — Part 1", "F")).toBe("Python Foundations")
    expect(repairTitle("Core Data Structures - Part 4", "F")).toBe("Core Data Structures")
    expect(repairTitle("Python Syntax Lesson 2", "F")).toBe("Python Syntax")
    expect(repairTitle("Variables Step 3", "F")).toBe("Variables")
  })
  it("cuts verbose colon/comma titles to the concept phrase", () => {
    expect(repairTitle("Core Python Foundations: Syntax, Data Types, and Control Flow", "F")).toBe("Core Python Foundations")
    expect(repairTitle("Applied Python: Functions, Data Structures, and Project Development", "F")).toBe("Applied Python")
  })
  it("caps very long titles at five words and falls back on empty", () => {
    expect(repairTitle("Introduction To Programming With Python From Scratch Today Now", "F")).toBe("Introduction To Programming With Python")
    expect(repairTitle("Python Syntax", "F")).toBe("Python Syntax")
    expect(repairTitle("   ", "Fallback")).toBe("Fallback")
    expect(repairTitle(null, "Fallback")).toBe("Fallback")
  })
  it("repairs titles flowing through normalizeRoadmapJson", () => {
    const out = normalizeRoadmapJson({
      title: "T",
      description: "D",
      phases: [{ title: "Python Foundations: Basics, Setup, and More Words Here", lessons: [{ title: "Python Foundations — Part 1", objective: "Learn." }] }],
    }, { goal: "Python", level: "Beginner", duration: "8 weeks" })
    expect(out?.phases?.[0]?.title).toBe("Python Foundations")
    expect(out?.phases?.[0]?.lessons?.[0]?.title).toBe("Python Foundations")
  })
})
