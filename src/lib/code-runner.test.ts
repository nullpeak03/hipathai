import { describe, it, expect, vi } from "vitest"
import { runnerLanguage, runCode, MAX_RUN_CODE_CHARS } from "./code-runner"

const okFetch = (payload: unknown) =>
  (vi.fn(async () => ({ ok: true, status: 200, json: async () => payload })) as unknown as typeof fetch)

describe("runnerLanguage", () => {
  it("maps lesson languages to pinned Wandbox compilers", () => {
    expect(runnerLanguage("python")).toBe("cpython-3.12.7")
    expect(runnerLanguage("Python")).toBe("cpython-3.12.7")
    expect(runnerLanguage("js")).toBe("nodejs-20.17.0")
    expect(runnerLanguage("sql")).toBe("sqlite-3.46.1")
    expect(runnerLanguage("cpp")).toBe("gcc-13.2.0")
    expect(runnerLanguage("text")).toBeNull()
    expect(runnerLanguage("csharp")).toBeNull()
    expect(runnerLanguage("kotlin")).toBeNull()
    expect(runnerLanguage("")).toBeNull()
    expect(runnerLanguage(null)).toBeNull()
  })
})

describe("runCode", () => {
  it("rejects unsupported languages, empty and oversize code without fetching", async () => {
    const f = vi.fn() as unknown as typeof fetch
    expect(await runCode("text", "x = 1", "", f)).toMatchObject({ ok: false })
    expect(await runCode("python", "   ", "", f)).toMatchObject({ ok: false })
    expect(await runCode("python", "x".repeat(MAX_RUN_CODE_CHARS + 1), "", f)).toMatchObject({ ok: false })
    expect(f).not.toHaveBeenCalled()
  })
  it("returns stdout/stderr and truncates long output", async () => {
    const res = await runCode(
      "python",
      "print('hi')",
      "",
      okFetch({ status: "0", program_output: "hi\n", program_error: "" })
    )
    expect(res).toMatchObject({ ok: true, stdout: "hi\n", exitCode: 0 })
    const big = await runCode("python", "print(1)", "", okFetch({ status: "0", program_output: "y".repeat(9000) }))
    expect(big.ok).toBe(true)
    if (big.ok) {
      expect(big.stdout.length).toBeLessThan(9000)
      expect(big.stdout).toContain("truncated")
    }
  })
  it("merges compiler and program errors with nonzero exit", async () => {
    const res = await runCode(
      "python",
      "print(x)",
      "",
      okFetch({ status: "1", program_output: "", program_error: "NameError: x" })
    )
    expect(res).toMatchObject({ ok: true, stderr: "NameError: x", exitCode: 1 })
  })
  it("surfaces HTTP failures and timeouts as friendly errors", async () => {
    const bad = (vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch)
    expect(await runCode("python", "x=1", "", bad)).toMatchObject({ ok: false, error: expect.stringContaining("503") })
    const hanging = vi.fn(
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const e = new Error("This operation was aborted")
            e.name = "AbortError"
            reject(e)
          })
        })
    ) as unknown as typeof fetch
    const slow = await runCode("python", "x=1", "", hanging, 50)
    expect(slow).toMatchObject({ ok: false, error: expect.stringContaining("taking too long") })
  })
})
