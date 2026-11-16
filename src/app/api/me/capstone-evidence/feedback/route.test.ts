import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const authMock = vi.fn()
const supabaseMock = vi.fn()
const rateLimitMock = vi.fn()
const callNimMock = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({ auth: () => authMock() }))
vi.mock("@/lib/supabase/server", () => ({ createServerClient: () => supabaseMock() }))
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => rateLimitMock(...args),
}))
vi.mock("@/lib/nim", () => ({ callNim: (opts: unknown) => callNimMock(opts) }))

import { POST } from "./route"
import { createSupabaseMock } from "@/test/supabase-mock"

const USER = "user_owner"
const ROADMAP = "b7596773-3890-4a4e-b78d-567ffd7e7f9b"
const LESSON = "3ec8fd16-9b1f-472a-91cf-0a30336c3ce0"

const EVIDENCE = {
  project_summary: "Built and deployed a small model service.",
  repository_url: "https://github.com/example/project",
  deployment_url: "https://example.com",
  implementation_complete: true,
  validation_complete: true,
  documentation_complete: true,
  reflection: "Monitoring was the hardest part.",
}

const post = (body: unknown = { roadmapId: ROADMAP, lessonId: LESSON }) =>
  POST(
    new NextRequest("http://localhost/api/me/capstone-evidence/feedback", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    })
  )

function mockDb(evidence: unknown = EVIDENCE) {
  const { client, calls } = createSupabaseMock({
    capstone_evidence: { data: evidence, error: null },
  })
  supabaseMock.mockReturnValue(client)
  return calls
}

describe("POST /api/me/capstone-evidence/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitMock.mockResolvedValue({ ok: true })
    callNimMock.mockResolvedValue({ modelUsed: "m", content: "Strengths: …\nGaps: …\nNext steps: …" })
  })

  it("refuses anonymous callers before spending a model call", async () => {
    authMock.mockResolvedValue({ userId: null })
    const res = await post()
    expect(res.status).toBe(401)
    expect(supabaseMock).not.toHaveBeenCalled()
    expect(callNimMock).not.toHaveBeenCalled()
  })

  it("enforces the daily cap", async () => {
    authMock.mockResolvedValue({ userId: USER })
    rateLimitMock.mockResolvedValue({ ok: false, retryAfterMs: 1000 })
    const res = await post()
    expect(res.status).toBe(429)
    expect(callNimMock).not.toHaveBeenCalled()
  })

  it("rejects a payload with no lesson", async () => {
    authMock.mockResolvedValue({ userId: USER })
    const res = await post({ roadmapId: ROADMAP })
    expect(res.status).toBe(400)
    expect(supabaseMock).not.toHaveBeenCalled()
  })

  it("asks for evidence to be saved first", async () => {
    authMock.mockResolvedValue({ userId: USER })
    mockDb(null)
    const res = await post()
    expect(res.status).toBe(400)
    expect(callNimMock).not.toHaveBeenCalled()
  })

  it("scopes the evidence lookup to the caller, roadmap and lesson", async () => {
    authMock.mockResolvedValue({ userId: USER })
    const calls = mockDb()
    await post()
    const filters = calls.filter((c) => c.method === "eq").map((c) => c.args)
    expect(filters).toEqual([
      ["user_id", USER],
      ["roadmap_id", ROADMAP],
      ["lesson_id", LESSON],
    ])
  })

  it("disables model thinking so the panel gets feedback, not reasoning", async () => {
    authMock.mockResolvedValue({ userId: USER })
    mockDb()
    const res = await post()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ feedback: "Strengths: …\nGaps: …\nNext steps: …" })
    expect(callNimMock).toHaveBeenCalledTimes(1)
    const opts = callNimMock.mock.calls[0][0] as { thinkingDisabled?: boolean; messages: { content: string }[] }
    expect(opts.thinkingDisabled).toBe(true)
    // The evidence must reach the prompt, otherwise the feedback is generic.
    expect(opts.messages[0].content).toContain(EVIDENCE.project_summary)
  })

  it("returns a clean error when the model fails", async () => {
    authMock.mockResolvedValue({ userId: USER })
    mockDb()
    callNimMock.mockRejectedValue(new Error("HTTP 500"))
    const res = await post()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Feedback unavailable" })
  })
})
