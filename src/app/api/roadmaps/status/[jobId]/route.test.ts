import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const authMock = vi.fn()
const supabaseMock = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({ auth: () => authMock() }))
vi.mock("@/lib/supabase/server", () => ({ createServerClient: () => supabaseMock() }))

import { GET } from "./route"
import { createSupabaseMock } from "@/test/supabase-mock"

const JOB = "4f8814b6-0000-4000-8000-000000000001"
const USER = "user_owner"
const OWNER_ROW = { status: "processing", error: null, result: { totalPhases: 6 }, started_at: new Date().toISOString(), completed_at: null, user_id: USER }

const call = (jobId = JOB) =>
  GET(new NextRequest(`http://localhost/api/roadmaps/status/${jobId}`), { params: Promise.resolve({ jobId }) })

/** Job row + an owner; `phases` feeds the live progress count. */
function withJob(job: Record<string, unknown> | null, extra: Record<string, { data?: unknown; error?: unknown; count?: number }> = {}) {
  const { client, calls } = createSupabaseMock({
    async_jobs: { data: job, error: null },
    phases: { data: null, error: null, count: 2 },
    ...extra,
  })
  supabaseMock.mockReturnValue(client)
  return calls
}

describe("GET /api/roadmaps/status/[jobId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("refuses anonymous callers", async () => {
    authMock.mockResolvedValue({ userId: null })
    const res = await call()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
    expect(supabaseMock).not.toHaveBeenCalled()
  })

  it("hides another user's job behind a 404", async () => {
    authMock.mockResolvedValue({ userId: USER })
    withJob({ ...OWNER_ROW, user_id: "user_someone_else" })

    const res = await call()
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ jobId: JOB, status: "not_found" })
  })

  it("reports live progress to the owner without leaking another one", async () => {
    authMock.mockResolvedValue({ userId: USER })
    withJob(OWNER_ROW)

    const res = await call()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ status: "processing", progress: { phasesDone: 2, totalPhases: 6 } })
  })

  it("returns the roadmap tree once the owner's job is complete", async () => {
    authMock.mockResolvedValue({ userId: USER })
    withJob(
      { ...OWNER_ROW, status: "completed", result: { totalPhases: 1 } },
      {
        roadmaps: {
          data: { id: JOB, user_id: USER, title: "T", description: "D", goal: "G", lessons_total: 1, created_at: new Date().toISOString() },
          error: null,
        },
        phases: { data: [{ id: "p1", idx: 1, title: "Phase" }], error: null },
        lessons: { data: [{ id: "l1", phase_id: "p1", idx: 1, title: "Lesson", content_md: null, example_code: null, content_json: null, quiz: null, quiz_bank: null, estimated_minutes: 10, prerequisites: [] }], error: null },
      }
    )

    const res = await call()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("completed")
    expect(body.roadmap.id).toBe(JOB)
    expect(body.roadmap.phases[0].lessons[0].title).toBe("Lesson")
  })

  it("does not serve a completed roadmap owned by someone else", async () => {
    authMock.mockResolvedValue({ userId: USER })
    withJob(
      { ...OWNER_ROW, status: "completed", result: { totalPhases: 1 } },
      {
        roadmaps: {
          data: { id: JOB, user_id: "user_someone_else", title: "T", description: "D", goal: "G", lessons_total: 1, created_at: new Date().toISOString() },
          error: null,
        },
      }
    )

    const res = await call()
    expect(res.status).toBe(404)
  })
})
