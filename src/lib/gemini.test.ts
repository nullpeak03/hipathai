import { describe, it, expect, vi, beforeAll, afterEach } from "vitest"

type GeminiModule = typeof import("./gemini")

let gemini: GeminiModule

beforeAll(async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-key")
  vi.stubEnv("GOOGLE_API_KEY", "")
  gemini = await import("./gemini")
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const okRes = (payload: unknown) =>
  ({ ok: true, status: 200, json: async () => payload }) as unknown as Response

const errRes = (status: number, msg: string) =>
  ({
    ok: false,
    status,
    json: async () => ({ error: { message: msg } }),
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

const textPayload = (text: string) => ({
  candidates: [{ content: { parts: [{ text }] } }],
})

describe("chatWithGemini", () => {
  it("maps roles and returns joined text", async () => {
    const calls = stubFetch(async () => okRes(textPayload("Hello! World.")))
    const res = await gemini.chatWithGemini(
      [
        { role: "system", content: "Be nice." },
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hey" },
        { role: "user", content: "Yo" },
      ],
      false,
      undefined,
      100,
      { retries: 0 }
    )
    expect(res).toEqual({ modelUsed: "gemini/gemini-3.6-flash", content: "Hello! World." })
    const body = JSON.parse(calls[0].init.body ?? "{}") as {
      systemInstruction?: { parts: { text: string }[] }
      contents: { role: string }[]
    }
    expect(body.systemInstruction?.parts[0].text).toBe("Be nice.")
    expect(body.contents.map((c) => c.role)).toEqual(["user", "model", "user"])
    expect(calls[0].url).toContain("gemini-3.6-flash:generateContent")
  })

  it("enforces JSON mode and extracts wrapped objects", async () => {
    const calls = stubFetch(async () =>
      okRes(textPayload('Here you go:\n```json\n{"questions":[{"q":"Q?"}]}\n```\nDone.'))
    )
    const res = await gemini.chatWithGemini(
      [{ role: "user", content: "Quiz me" }],
      true,
      undefined,
      200,
      { retries: 0 }
    )
    expect(res.content).toBe('{"questions":[{"q":"Q?"}]}')
    const body = JSON.parse(calls[0].init.body ?? "{}") as {
      generationConfig?: { responseMimeType?: string }
    }
    expect(body.generationConfig?.responseMimeType).toBe("application/json")
  })

  it("retries rate limits then succeeds", async () => {
    let n = 0
    stubFetch(async () => {
      n++
      return n === 1 ? errRes(429, "slow down") : okRes(textPayload("ok"))
    })
    const res = await gemini.chatWithGemini([{ role: "user", content: "Hi" }])
    expect(res.content).toBe("ok")
    expect(n).toBe(2)
  })

  it("fails fast on client errors", async () => {
    let n = 0
    stubFetch(async () => {
      n++
      return errRes(400, "bad request")
    })
    await expect(
      gemini.chatWithGemini([{ role: "user", content: "Hi" }], false, undefined, 100, { retries: 2 })
    ).rejects.toThrow(/HTTP 400/)
    expect(n).toBe(1)
  })

  it("retries aborted requests", async () => {
    let n = 0
    stubFetch(async () => {
      n++
      if (n === 1) throw new Error("This operation was aborted")
      return okRes(textPayload("recovered"))
    })
    const res = await gemini.chatWithGemini([{ role: "user", content: "Hi" }])
    expect(res.content).toBe("recovered")
    expect(n).toBe(2)
  })

  it("surfaces safety blocks", async () => {
    stubFetch(async () => okRes({ promptFeedback: { blockReason: "SAFETY" }, candidates: [] }))
    await expect(
      gemini.chatWithGemini([{ role: "user", content: "Hi" }], false, undefined, 100, { retries: 0 })
    ).rejects.toThrow(/safety/i)
  })

  it("throws a clear error without a key", async () => {
    vi.resetModules()
    vi.stubEnv("GEMINI_API_KEY", "")
    vi.stubEnv("GOOGLE_API_KEY", "")
    const noKey = await import("./gemini")
    await expect(noKey.chatWithGemini([{ role: "user", content: "Hi" }])).rejects.toThrow("GEMINI_KEY_MISSING")
    vi.stubEnv("GEMINI_API_KEY", "test-key")
    gemini = await import("./gemini")
  })
})

describe("isRetriableStatus", () => {
  it("retries timeouts and server/rate errors", () => {
    expect(gemini.isRetriableStatus(undefined)).toBe(true)
    expect(gemini.isRetriableStatus(429)).toBe(true)
    expect(gemini.isRetriableStatus(503)).toBe(true)
  })
  it("fails fast on deterministic errors", () => {
    for (const s of [400, 401, 403, 404]) {
      expect(gemini.isRetriableStatus(s)).toBe(false)
    }
  })
})
