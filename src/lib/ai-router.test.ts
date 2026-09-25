import { describe, it, expect, vi, afterEach } from "vitest"

afterEach(() => {
  vi.unstubAllGlobals()
})

const okRes = (payload: unknown) =>
  ({ ok: true, status: 200, json: async () => payload }) as unknown as Response

const errRes = (status: number) =>
  ({
    ok: false,
    status,
    json: async () => ({}),
    text: async () => `HTTP ${status}`,
  }) as unknown as Response

describe("AI_ROUTES", () => {
  it("maps each feature to its verified model and budget", async () => {
    const { AI_ROUTES } = await import("./ai-router")
    expect(AI_ROUTES.roadmap.model).toContain("ultra")
    expect(AI_ROUTES.lesson.model).toContain("super")
    expect(AI_ROUTES.quiz.model).toContain("lightning")
    expect(AI_ROUTES.tutor.model).toContain("nano")
    expect(AI_ROUTES.weakness.model).toContain("glimmer")
    expect(AI_ROUTES.roadmap.timeoutMs).toBeGreaterThanOrEqual(AI_ROUTES.quiz.timeoutMs)
    expect(AI_ROUTES.quiz.thinkingDisabled).toBe(true)
    expect(AI_ROUTES.tutor.thinkingDisabled).toBe(true)
    expect(AI_ROUTES.lesson.thinkingDisabled).toBe(true)
    // Regression: the Ultra roadmap primary once streamed reasoning instead
    // of JSON ("Invalid JSON from model" → fallback cascade).
    expect(AI_ROUTES.roadmap.thinkingDisabled).toBe(true)
    expect(AI_ROUTES.lesson.jsonKeys).toContain("sections")
    expect(AI_ROUTES.quiz.jsonKeys).toContain("questions")
    expect(AI_ROUTES.roadmap.jsonKeys).toContain("phases")
  })
  it("gives every feature a distinct NIM fallback model", async () => {
    const { AI_ROUTES } = await import("./ai-router")
    for (const [feature, route] of Object.entries(AI_ROUTES)) {
      expect(route.fallbackModel, feature).toMatch(/^[^/]+\/[^/]+/)
      expect(route.fallbackModel, feature).not.toContain("gemini")
    }
    expect(AI_ROUTES.roadmap.fallbackModel).not.toBe(AI_ROUTES.roadmap.model)
  })
})

describe("chatForFeature fallback", () => {
  it("serves from NIMs when healthy", async () => {
    vi.stubEnv("NVIDIA_NIM_API_KEY", "nim-key")
    const calls: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        calls.push(String(url))
        return okRes({ choices: [{ message: { content: "nim says hi", role: "assistant" } }] })
      }) as unknown as typeof fetch
    )
    const { chatForFeature } = await import("./ai-router")
    const res = await chatForFeature("quiz", [{ role: "user", content: "Hi" }], { retries: 0 })
    expect(res.modelUsed).toContain("nim/")
    expect(res.content).toBe("nim says hi")
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain("integrate.api.nvidia.com")
  })

  it("falls back to the second NIM model when the primary fails", async () => {
    vi.stubEnv("NVIDIA_NIM_API_KEY", "nim-key")
    const seen: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
        const model = (JSON.parse(String((init as { body?: string })?.body ?? "{}")) as { model?: string }).model ?? ""
        seen.push(model)
        if (model.includes("lightning")) return errRes(500)
        return okRes({ choices: [{ message: { content: "nim fallback saves the day", role: "assistant" } }] })
      }) as unknown as typeof fetch
    )
    const { chatForFeature } = await import("./ai-router")
    const res = await chatForFeature("quiz", [{ role: "user", content: "Hi" }], { retries: 0 })
    expect(res.modelUsed).toContain("nim/")
    expect(res.content).toBe("nim fallback saves the day")
    expect(seen[0]).toContain("lightning")
    expect(seen[1]).toContain("nano")
    expect(seen.every((m) => !m.includes("gemini"))).toBe(true)
  })

  it("honors a per-call jsonKeys override (phase shape has no phases key)", async () => {
    vi.stubEnv("NVIDIA_NIM_API_KEY", "nim-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        okRes({ choices: [{ message: { content: '{"title":"W1","lessons":[{"title":"Python Syntax","objective":"Learn."}]}', role: "assistant" } }] })
      ) as unknown as typeof fetch
    )
    const { chatForFeature } = await import("./ai-router")
    // Without the override this shape is rejected ("Invalid JSON from model")
    await expect(
      chatForFeature("roadmap", [{ role: "user", content: "Hi" }], { jsonMode: true, retries: 0 })
    ).rejects.toThrow(/Invalid JSON/)
    const res = await chatForFeature("roadmap", [{ role: "user", content: "Hi" }], { jsonMode: true, retries: 0, jsonKeys: ["lessons"] })
    expect(res.modelUsed).toContain("nim/")
    expect(res.content).toContain("Python Syntax")
  })

  it("throws when all NIM models fail", async () => {
    vi.stubEnv("NVIDIA_NIM_API_KEY", "nim-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => errRes(500)) as unknown as typeof fetch
    )
    const { chatForFeature } = await import("./ai-router")
    await expect(chatForFeature("quiz", [{ role: "user", content: "Hi" }], { retries: 0 })).rejects.toThrow(/HTTP 500/)
  })

  it("fails loud when the NIM key is missing", async () => {
    vi.stubEnv("NVIDIA_NIM_API_KEY", "")
    const { chatForFeature } = await import("./ai-router")
    await expect(chatForFeature("quiz", [{ role: "user", content: "Hi" }], { retries: 0 })).rejects.toThrow("NIM_KEY_MISSING")
  })
})

describe("lesson contract keys", () => {
  it("accepts sections documents from the lesson primary", async () => {
    vi.stubEnv("NVIDIA_NIM_API_KEY", "nim-key")
    const calls: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        calls.push(String(url))
        return okRes({
          choices: [{
            message: {
              content: 'intro\n{"sections":[{"type":"paragraph","text":"Hello."}]}',
              role: "assistant",
            },
          }],
        })
      }) as unknown as Response
    )
    const { chatForFeature } = await import("./ai-router")
    const res = await chatForFeature(
      "lesson",
      [{ role: "user", content: "Teach me" }],
      { jsonMode: true, retries: 0 }
    )
    expect(res.modelUsed).toContain("nim/")
    expect(res.content).toContain('"sections"')
    expect(calls).toHaveLength(1)
  })
})
