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
    // The retired super primary 410'd, so Ultra was already writing every
    // lesson via the fallback; it is now the named primary.
    expect(AI_ROUTES.lesson.model).toContain("ultra")
    expect(AI_ROUTES.lesson.fallbackModel).toContain("lightning")
    // Quiz and Tutor now use Lightning primary (fast, good JSON), Nano fallback.
    expect(AI_ROUTES.quiz.model).toContain("lightning")
    expect(AI_ROUTES.quiz.fallbackModel).toContain("nano")
    expect(AI_ROUTES.tutor.model).toContain("lightning")
    expect(AI_ROUTES.tutor.fallbackModel).toContain("nano")
    // muse-glimmer stalled past the route timeout on every call.
    expect(AI_ROUTES.weakness.model).toContain("lightning")
    // Verified multimodal 2026-11-16: Nano/Omni and Bolt accept image_url,
    // Lightning and Ultra reject it, and the old super-vl 404'd.
    expect(AI_ROUTES.vision.model).toContain("nano")
    expect(AI_ROUTES.vision.fallbackModel).toContain("bolt")
    // Every route must fit one serverless step (60s invocation cap).
    for (const [feature, route] of Object.entries(AI_ROUTES)) {
      expect(route.timeoutMs, feature).toBeLessThanOrEqual(60000)
    }
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
  it("marks tutor lenient and keeps strict features strict", async () => {
    const { AI_ROUTES } = await import("./ai-router")
    expect(AI_ROUTES.tutor.lenientJson).toBe(true)
    expect(AI_ROUTES.quiz.lenientJson ?? false).toBe(false)
    expect(AI_ROUTES.lesson.lenientJson ?? false).toBe(false)
    expect(AI_ROUTES.roadmap.lenientJson ?? false).toBe(false)
  })

  it("tutor accepts prose replies without throwing", async () => {
    vi.stubEnv("NVIDIA_NIM_API_KEY", "nim-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        okRes({ choices: [{ message: { content: "x is 5, plain prose.", role: "assistant" } }] })
      ) as unknown as typeof fetch
    )
    const { chatForFeature } = await import("./ai-router")
    const res = await chatForFeature("tutor", [{ role: "user", content: "Hi" }], { jsonMode: true, retries: 0 })
    expect(res.modelUsed).toContain("nim/")
    expect(res.content).toBe("x is 5, plain prose.")
  })

  it("gives every feature a distinct NIM fallback model", async () => {
    const { AI_ROUTES } = await import("./ai-router")
    for (const [feature, route] of Object.entries(AI_ROUTES)) {
      expect(route.fallbackModel, feature).toMatch(/^[^/]+\/[^/]+/)
      expect(route.fallbackModel, feature).not.toContain("gemini")
    }
    expect(AI_ROUTES.roadmap.fallbackModel).not.toBe(AI_ROUTES.roadmap.model)
  })

  it("keeps the model probe script in step with the router table", async () => {
    const { AI_ROUTES } = await import("./ai-router")
    const { readFileSync } = await import("node:fs")
    const script = readFileSync(new URL("../../scripts/check-ai.mjs", import.meta.url), "utf8")
    const probes = [...script.matchAll(/\["([a-z-]+)", process\.env\.[A-Z0-9_]+ \|\| "([^"]+)"\]/g)]
      .map((m) => [m[1], m[2]] as const)
    // Each configured slot is probed, so a retired fallback cannot hide behind
    // a healthy primary (that is how the 410'd fallbacks survived for months).
    for (const [feature, route] of Object.entries(AI_ROUTES)) {
      expect(probes, feature).toContainEqual([feature, route.model])
      expect(probes, feature).toContainEqual([`${feature}-fallback`, route.fallbackModel])
    }
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
    vi.stubEnv("NVIDIA_NIM_API_KEY_2", "")
    const { chatForFeature } = await import("./ai-router")
    await expect(chatForFeature("quiz", [{ role: "user", content: "Hi" }], { retries: 0 })).rejects.toThrow("NIM_KEY_MISSING")
  })

  it("runs on the second key alone", async () => {
    vi.stubEnv("NVIDIA_NIM_API_KEY", "")
    vi.stubEnv("NVIDIA_NIM_API_KEY_2", "nim-key-two")
    const seen: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: { headers?: Record<string, string> }) => {
        seen.push(init?.headers?.Authorization ?? "")
        return okRes({ choices: [{ message: { content: "from key two", role: "assistant" } }] })
      }) as unknown as typeof fetch
    )
    const { chatForFeature } = await import("./ai-router")
    const res = await chatForFeature("quiz", [{ role: "user", content: "Hi" }], { retries: 0 })
    expect(res.content).toBe("from key two")
    expect(seen).toEqual(["Bearer nim-key-two"])
    vi.stubEnv("NVIDIA_NIM_API_KEY_2", "")
    vi.stubEnv("NVIDIA_NIM_API_KEY", "nim-key")
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

describe("step deadline", () => {
  it("skips the fallback when the primary used up the deadline", async () => {
    vi.stubEnv("NVIDIA_NIM_API_KEY", "nim-key")
    const seen: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
        const model = (JSON.parse(String((init as { body?: string })?.body ?? "{}")) as { model?: string }).model ?? ""
        seen.push(model)
        // Primary burns most of the budget before failing (slow model, aborted)
        if (model.includes("lightning")) await new Promise((r) => setTimeout(r, 40))
        return errRes(503)
      }) as unknown as typeof fetch
    )
    const { chatForFeature } = await import("./ai-router")
    await expect(
      chatForFeature("quiz", [{ role: "user", content: "Hi" }], { retries: 0, timeoutMs: 5000, deadlineMs: 1500 })
    ).rejects.toThrow(/HTTP 503/)
    // Only the primary ran — no fallback call could have finished in time.
    expect(seen).toHaveLength(1)
    expect(seen[0]).toContain("lightning")
  })

  it("races the fallback when the primary is still silent past the hedge window", async () => {
    vi.stubEnv("NVIDIA_NIM_API_KEY", "nim-key")
    const seen: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
        const model = (JSON.parse(String((init as { body?: string })?.body ?? "{}")) as { model?: string }).model ?? ""
        seen.push(model)
        // Slow reasoning primary: never answers before the fallback does.
        if (model.includes("lightning")) await new Promise((r) => setTimeout(r, 150))
        return okRes({ choices: [{ message: { content: "fast fallback wins", role: "assistant" } }] })
      }) as unknown as typeof fetch
    )
    const { chatForFeature } = await import("./ai-router")
    const started = Date.now()
    const res = await chatForFeature("quiz", [{ role: "user", content: "Hi" }], {
      retries: 0,
      timeoutMs: 500,
      deadlineMs: 500,
      hedgeAfterMs: 20,
    })
    expect(res.content).toBe("fast fallback wins")
    expect(res.modelUsed).toContain("nano")
    expect(seen).toHaveLength(2)
    // The fallback did not wait for the primary's full timeout.
    expect(Date.now() - started).toBeLessThan(150)
  })

  it("serves the primary when it answers before the hedge window", async () => {
    vi.stubEnv("NVIDIA_NIM_API_KEY", "nim-key")
    let calls = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1
        return okRes({ choices: [{ message: { content: "primary is healthy", role: "assistant" } }] })
      }) as unknown as typeof fetch
    )
    const { chatForFeature } = await import("./ai-router")
    const res = await chatForFeature("quiz", [{ role: "user", content: "Hi" }], {
      retries: 0,
      timeoutMs: 500,
      deadlineMs: 500,
      hedgeAfterMs: 200,
    })
    expect(res.content).toBe("primary is healthy")
    expect(calls).toBe(1)
  })

  it("still falls back when the primary failed fast", async () => {
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
    const res = await chatForFeature("quiz", [{ role: "user", content: "Hi" }], { retries: 0, timeoutMs: 20000 })
    expect(res.content).toContain("saves the day")
    expect(seen).toHaveLength(2)
    expect(seen[1]).toContain("nano")
  })

  it("makes a single attempt by default (no hidden in-call retry)", async () => {
    vi.stubEnv("NVIDIA_NIM_API_KEY", "nim-key")
    let calls = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1
        return errRes(500)
      }) as unknown as typeof fetch
    )
    const { chatForFeature } = await import("./ai-router")
    await expect(chatForFeature("quiz", [{ role: "user", content: "Hi" }])).rejects.toThrow(/HTTP 500/)
    expect(calls).toBe(2) // primary + fallback, one attempt each
  })
})
