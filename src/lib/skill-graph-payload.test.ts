import { describe, expect, it } from "vitest"
import { normalizeSkillNodes } from "./skill-graph-payload"

const ROADMAP = "b7596773-3890-4a4e-b78d-567ffd7e7f9b"
const LESSON = "76d14137-f94a-45d5-be08-5ef72a7e7824"

describe("normalizeSkillNodes", () => {
  it("dedupes by topic so the upsert cannot touch one row twice", () => {
    const rows = normalizeSkillNodes(ROADMAP, [
      { topic: "Capstone", lesson_id: "a" },
      { topic: "Linear Algebra", lesson_id: "b" },
      { topic: "Capstone", lesson_id: "c" },
    ])
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.topic)).toEqual(["Capstone", "Linear Algebra"])
    // last write wins, like the previous per-row behaviour would have been
    expect(rows[0].lesson_id).toBe("c")
  })

  it("accepts both lessonId and lesson_id", () => {
    const rows = normalizeSkillNodes(ROADMAP, [
      { topic: "A", lessonId: "one" },
      { topic: "B", lesson_id: "two" },
      { topic: "C", lesson_id: null },
    ])
    expect(rows.map((r) => r.lesson_id)).toEqual(["one", "two", null])
  })

  it("drops entries without a usable topic instead of failing the batch", () => {
    const rows = normalizeSkillNodes(ROADMAP, [
      { topic: "  " },
      { topic: 42 },
      {},
      { topic: "Valid" },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].topic).toBe("Valid")
  })

  it("trims topics and keeps the roadmap id from the request", () => {
    const rows = normalizeSkillNodes(ROADMAP, [{ topic: "  Vectors  " }])
    expect(rows[0]).toMatchObject({ topic: "Vectors", roadmap_id: ROADMAP })
  })

  it("nulls lesson links that belong to another roadmap", () => {
    const rows = normalizeSkillNodes(
      ROADMAP,
      [
        { topic: "Mine", lesson_id: LESSON },
        { topic: "Foreign", lesson_id: "someone-elses-lesson" },
      ],
      new Set([LESSON])
    )
    expect(rows.map((r) => r.lesson_id)).toEqual([LESSON, null])
  })

  it("sanitises difficulty and prerequisites", () => {
    const rows = normalizeSkillNodes(ROADMAP, [
      { topic: "A", difficulty: 7, prerequisites: ["x", 3, null, "y"] as unknown[] },
      { topic: "B", difficulty: "hard" },
    ])
    expect(rows[0]).toMatchObject({ difficulty: null, prerequisites: ["x", "y"] })
    expect(rows[1]).toMatchObject({ difficulty: "hard", prerequisites: [] })
  })

  it("returns an empty list for a non-array payload", () => {
    expect(normalizeSkillNodes(ROADMAP, undefined as never)).toEqual([])
  })
})
