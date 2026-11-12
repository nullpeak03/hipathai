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

describe("callNim timeouts", () => {
  it("names the timeout instead of leaking undici's abort message", async () => {
    const { callNim } = await import("./nim")
    // Reject on abort like fetch does when its AbortSignal fires.
    stubFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = (init as unknown as { signal?: AbortSignal }).signal
          signal?.addEventListener("abort", () => reject(new Error("This operation was aborted")))
        })
    )
    await expect(callNim({ model: "m", messages: [{ role: "user", content: "hi" }], timeoutMs: 20 })).rejects.toThrow(
      /Request timed out after 20ms/
    )
  })

  it("still reports non-timeout network failures as request failures", async () => {
    const { callNim } = await import("./nim")
    stubFetch(async () => {
      throw new Error("ECONNRESET")
    })
    await expect(callNim({ model: "m", messages: [{ role: "user", content: "hi" }], timeoutMs: 5000 })).rejects.toThrow(
      /Request failed: ECONNRESET/
    )
  })

  it("refuses to start an attempt after the shared deadline", async () => {
    const { callNim } = await import("./nim")
    let calls = 0
    stubFetch(async () => {
      calls += 1
      return okRes({ choices: [{ message: { content: "too late" } }] })
    })
    await expect(
      callNim({
        model: "m",
        messages: [{ role: "user", content: "hi" }],
        timeoutMs: 5000,
        deadlineAt: Date.now() - 1,
      })
    ).rejects.toThrow(/Request timed out after 5000ms/)
    expect(calls).toBe(0)
  })

  it("does not sleep into a deadline it can no longer meet", async () => {
    const { callNim } = await import("./nim")
    let calls = 0
    stubFetch(async () => {
      calls += 1
      return errRes(503)
    })
    await expect(
      callNim({
        model: "m",
        messages: [{ role: "user", content: "hi" }],
        timeoutMs: 5000,
        retries: 2,
        // First retry would wait 2s, past this deadline — fail now instead.
        deadlineAt: Date.now() + 1500,
      })
    ).rejects.toThrow(/HTTP 503/)
    expect(calls).toBe(1)
  })

  it("retries NVCF function-not-found on a different backend node", async () => {
    const { callNim } = await import("./nim")
    const nvcf404 = {
      ok: false,
      status: 404,
      json: async () => ({}),
      text: async () =>
        '{"status":404,"title":"Not Found","detail":"Function \'ac74040f-9fc9-4c5e-ac74-279ba5161d69\': Not found for account \'qHIbJKdc\'"}',
    } as unknown as Response
    let calls = 0
    stubFetch(async () => {
      calls += 1
      return calls < 3 ? nvcf404 : okRes({ choices: [{ message: { content: "ok" } }] })
    })
    const res = await callNim({ model: "m", messages: [{ role: "user", content: "hi" }], retries: 0 })
    expect(res.content).toBe("ok")
    expect(calls).toBe(3)
  })

  it("gives up after two NVCF retries", async () => {
    const { callNim } = await import("./nim")
    let calls = 0
    stubFetch(async () => {
      calls += 1
      return {
        ok: false,
        status: 404,
        json: async () => ({}),
        text: async () => '{"detail":"Function \'ac74040f\': Not found for account \'qHIbJKdc\'"}',
      } as unknown as Response
    })
    await expect(
      callNim({ model: "m", messages: [{ role: "user", content: "hi" }], retries: 0 })
    ).rejects.toThrow(/not found for account/i)
    expect(calls).toBe(3)
  })
})
