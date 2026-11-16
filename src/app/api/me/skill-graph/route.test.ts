import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const authMock = vi.fn()
const supabaseMock = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({ auth: () => authMock() }))
vi.mock("@/lib/supabase/server", () => ({ createServerClient: () => supabaseMock() }))

import { POST } from "./route"
import { createSupabaseMock } from "@/test/supabase-mock"

const USER = "user_owner"
const ROADMAP = "b7596773-3890-4a4e-b78d-567ffd7e7f9b"
const LESSON = "76d14137-f94a-45d5-be08-5ef72a7e7824"

const post = (body: unknown) =>
  POST(
    new NextRequest(`http://localhost/api/me/skill-graph`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    })
  )

function mockDb({ owner = USER as string | null } = {}) {
  const { client, calls } = createSupabaseMock({
    roadmaps: { data: owner ? { id: ROADMAP, user_id: owner } : null, error: owner ? null : { code: "PGRST116" } },
    lessons: { data: [{ id: LESSON }], error: null },
    skill_nodes: { data: null, error: null },
  })
  supabaseMock.mockReturnValue(client)
  return calls
}

describe("POST /api/me/skill-graph", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("refuses anonymous callers", async () => {
    authMock.mockResolvedValue({ userId: null })
    const res = await post({ roadmapId: ROADMAP, nodes: [] })
    expect(res.status).toBe(401)
    expect(supabaseMock).not.toHaveBeenCalled()
  })

  it("rejects malformed payloads before touching the database", async () => {
    authMock.mockResolvedValue({ userId: USER })
    const res = await post({ nodes: [] })
    expect(res.status).toBe(400)
    expect(supabaseMock).not.toHaveBeenCalled()
  })

  it("will not write to a roadmap the caller does not own", async () => {
    authMock.mockResolvedValue({ userId: USER })
    const calls = mockDb({ owner: null })
    const res = await post({ roadmapId: ROADMAP, nodes: [{ topic: "A" }] })
    expect(res.status).toBe(404)
    expect(calls.some((c) => c.method === "upsert")).toBe(false)
  })

  it("dedupes topics and keeps only this roadmap's lesson links", async () => {
    authMock.mockResolvedValue({ userId: USER })
    const calls = mockDb()
    const res = await post({
      roadmapId: ROADMAP,
      nodes: [
        { roadmap_id: ROADMAP, lesson_id: LESSON, topic: "Capstone", prerequisites: [] },
        { roadmap_id: ROADMAP, lesson_id: LESSON, topic: "Vectors", prerequisites: [LESSON] },
        { roadmap_id: ROADMAP, lesson_id: "lesson-from-another-roadmap", topic: "Extra" },
        { roadmap_id: ROADMAP, lesson_id: LESSON, topic: "Capstone" },
      ],
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, count: 3 })

    const upsert = calls.find((c) => c.method === "upsert")
    const rows = upsert?.args[0] as Array<{ topic: string; lesson_id: string | null }>
    expect(rows.map((r) => r.topic)).toEqual(["Capstone", "Vectors", "Extra"])
    expect(rows.map((r) => r.lesson_id)).toEqual([LESSON, LESSON, null])
    expect(upsert?.args[1]).toEqual({ onConflict: "roadmap_id,topic" })
  })

  it("does not call the database when every node is unusable", async () => {
    authMock.mockResolvedValue({ userId: USER })
    const calls = mockDb()
    const res = await post({ roadmapId: ROADMAP, nodes: [{ topic: "  " }, {}] })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, count: 0 })
    expect(calls.some((c) => c.method === "upsert")).toBe(false)
  })
})
