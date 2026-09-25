import { describe, it, expect, vi, beforeAll, afterEach } from "vitest"

beforeAll(() => {
  vi.stubEnv("NVIDIA_NIM_API_KEY", "test-nim-key")
})

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

function stubFetch(impl: (url: unknown, init: { body?: string }) => Promise<Response>) {
  const calls: { url: unknown; init: { body?: string } }[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init: { body?: string }) => {
      calls.push({ url, init })
      return impl(url, init)
    }) as unknown as typeof fetch
  )
  return calls
}

describe("callNim", () => {
  it("sends thinking-disabled flag and returns content", async () => {
    const { callNim } = await import("./nim")
    const calls = stubFetch(async () =>
      okRes({ choices: [{ message: { content: "ok", role: "assistant" } }] })
    )
    const res = await callNim({
      model: "nvidia/nemotron-3.5-lightning-30b-a3b",
      messages: [{ role: "user", content: "Hi" }],
      thinkingDisabled: true,
      retries: 0,
    })
    expect(res).toEqual({
      modelUsed: "nim/nvidia/nemotron-3.5-lightning-30b-a3b",
      content: "ok",
    })
    const body = JSON.parse(calls[0].init.body ?? "{}") as {
      chat_template_kwargs?: { enable_thinking?: boolean }
    }
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false })
  })

  it("omits the flag when not requested", async () => {
    const { callNim } = await import("./nim")
    const calls = stubFetch(async () =>
      okRes({ choices: [{ message: { content: "ok", role: "assistant" } }] })
    )
    await callNim({
      model: "nvidia/nemotron-3-ultra-550b-a55b",
      messages: [{ role: "user", content: "Hi" }],
      retries: 0,
    })
    const body = JSON.parse(calls[0].init.body ?? "{}") as Record<string, unknown>
    expect("chat_template_kwargs" in body).toBe(false)
  })

  it("falls back to reasoning_content and extracts JSON in jsonMode", async () => {
    const { callNim } = await import("./nim")
    stubFetch(async () =>
      okRes({
        choices: [{
          message: {
            content: null,
            reasoning_content: 'thinking...\n{"questions":[{"q":"Q?"}]}',
            role: "assistant",
          },
        }],
      })
    )
    const res = await callNim({
      model: "meta/muse-glimmer-30b",
      messages: [{ role: "user", content: "Quiz" }],
      jsonMode: true,
      retries: 0,
    })
    expect(res.content).toBe('{"questions":[{"q":"Q?"}]}')
  })

  it("returns raw text with allowRaw when JSON extraction fails", async () => {
    const { callNim } = await import("./nim")
    stubFetch(async () =>
      okRes({ choices: [{ message: { content: '{"type":"paragraph","text":"Hi."}', role: "assistant" } }] })
    )
    // Strict (default): bare block without the contract key still throws
    await expect(
      callNim({
        model: "m",
        messages: [{ role: "user", content: "Hi" }],
        jsonMode: true,
        jsonKeys: ["sections"],
        retries: 0,
      })
    ).rejects.toThrow(/Invalid JSON/)
    // Lenient (tutor): raw reply passes through for downstream wrapping
    const res = await callNim({
      model: "m",
      messages: [{ role: "user", content: "Hi" }],
      jsonMode: true,
      jsonKeys: ["sections"],
      allowRaw: true,
      retries: 0,
    })
    expect(res.content).toBe('{"type":"paragraph","text":"Hi."}')
  })

  it("retries overloads and fails fast on missing functions", async () => {
    const { callNim } = await import("./nim")
    let n = 0
    stubFetch(async () => {
      n++
      return n === 1 ? errRes(503) : okRes({ choices: [{ message: { content: "ok" } }] })
    })
    const res = await callNim({
      model: "m",
      messages: [{ role: "user", content: "Hi" }],
      retries: 1,
    })
    expect(res.content).toBe("ok")
    expect(n).toBe(2)

    let m = 0
    stubFetch(async () => {
      m++
      return errRes(404)
    })
    await expect(
      callNim({ model: "m", messages: [{ role: "user", content: "Hi" }], retries: 2 })
    ).rejects.toThrow(/HTTP 404/)
    expect(m).toBe(1)
  })

  it("throws a clear error without a key", async () => {
    vi.resetModules()
    vi.stubEnv("NVIDIA_NIM_API_KEY", "")
    const noKey = await import("./nim")
    await expect(
      noKey.callNim({ model: "m", messages: [{ role: "user", content: "Hi" }] })
    ).rejects.toThrow("NIM_KEY_MISSING")
    vi.stubEnv("NVIDIA_NIM_API_KEY", "test-nim-key")
  })
})
