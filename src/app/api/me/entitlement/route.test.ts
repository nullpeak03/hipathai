import { beforeEach, describe, expect, it, vi } from "vitest"

const authMock = vi.fn()
const supabaseMock = vi.fn()
const unlimitedMock = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({ auth: () => authMock() }))
vi.mock("@/lib/supabase/server", () => ({ createServerClient: () => supabaseMock() }))
vi.mock("@/lib/unlimited", () => ({ isUnlimitedUser: (id: string | null | undefined) => unlimitedMock(id) }))

import { GET } from "./route"
import { createSupabaseMock } from "@/test/supabase-mock"

const USER = "user_learner"

describe("GET /api/me/entitlement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    unlimitedMock.mockResolvedValue(false)
  })

  it("reads as free and not a reviewer when signed out", async () => {
    authMock.mockResolvedValue({ userId: null })
    const res = await GET()
    expect(await res.json()).toEqual({ pro: false, reviewer: false })
    expect(supabaseMock).not.toHaveBeenCalled()
  })

  it("marks the reviewer account without a second query", async () => {
    authMock.mockResolvedValue({ userId: USER })
    unlimitedMock.mockResolvedValue(true)
    const res = await GET()
    expect(await res.json()).toEqual({ pro: true, reviewer: true })
    expect(supabaseMock).not.toHaveBeenCalled()
  })

  it("keeps pro separate from reviewer", async () => {
    authMock.mockResolvedValue({ userId: USER })
    supabaseMock.mockReturnValue(createSupabaseMock({ users: { data: { is_pro: true }, error: null } }).client)
    const res = await GET()
    expect(await res.json()).toEqual({ pro: true, reviewer: false })
  })

  it("reads a free learner as neither", async () => {
    authMock.mockResolvedValue({ userId: USER })
    supabaseMock.mockReturnValue(createSupabaseMock({ users: { data: { is_pro: false }, error: null } }).client)
    const res = await GET()
    expect(await res.json()).toEqual({ pro: false, reviewer: false })
  })

  it("never errors the client when the database fails", async () => {
    authMock.mockResolvedValue({ userId: USER })
    supabaseMock.mockReturnValue(createSupabaseMock({ users: { data: null, error: { message: "boom" } } }).client)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ pro: false, reviewer: false })
  })
})
