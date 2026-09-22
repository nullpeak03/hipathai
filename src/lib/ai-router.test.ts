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
    expect(AI_ROUTES.lesson.jsonKeys).toContain("sections")
    expect(AI_ROUTES.quiz.jsonKeys).toContain("questions")
    expect(AI_ROUTES.roadmap.jsonKeys).toContain("phases")
  })
})

describe("chatForFeature fallback", () => {
  it("serves from NIMs when healthy", async () => {
    vi.stubEnv("NVIDIA_NIM_API_KEY", "nim-key")
    vi.stubEnv("GEMINI_API_KEY", "gemini-key")
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

  it("falls back to Gemini when NIMs fails", async () => {
    vi.stubEnv("NVIDIA_NIM_API_KEY", "nim-key")
    vi.stubEnv("GEMINI_API_KEY", "gemini-key")
    vi.stubEnv("GEMINI_API_KEY_TUTOR", "")
    vi.stubEnv("GEMINI_API_KEY_ROADMAP", "")
    vi.stubEnv("GOOGLE_API_KEY", "")
    const calls: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        calls.push(String(url))
        if (String(url).includes("integrate.api.nvidia.com")) return errRes(500)
        return okRes({ candidates: [{ content: { parts: [{ text: "gemini saves the day" }] } }] })
      }) as unknown as typeof fetch
    )
    const { chatForFeature } = await import("./ai-router")
    const res = await chatForFeature("quiz", [{ role: "user", content: "Hi" }], { retries: 0 })
    expect(res.modelUsed).toContain("gemini/")
    expect(res.content).toBe("gemini saves the day")
    expect(calls[0]).toContain("integrate.api.nvidia.com")
    expect(calls[calls.length - 1]).toContain("generativelanguage.googleapis.com")
  })
})

describe("lesson contract keys", () => {
  it("accepts sections documents from the lesson primary", async () => {
    vi.stubEnv("NVIDIA_NIM_API_KEY", "nim-key")
    vi.stubEnv("GEMINI_API_KEY", "gemini-key")
    vi.stubEnv("GEMINI_API_KEY_TUTOR", "")
    vi.stubEnv("GEMINI_API_KEY_ROADMAP", "")
    vi.stubEnv("GOOGLE_API_KEY", "")
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
