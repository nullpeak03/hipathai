import { describe, it, expect, vi } from "vitest"
import { runnerLanguage, runCode, codeNeedsStdin, countStdinReads, firstErrorLine, preflightStdinError, MAX_RUN_CODE_CHARS } from "./code-runner"

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

describe("codeNeedsStdin", () => {
  it("detects interactive reads per language, case- and alias-insensitively", () => {
    expect(codeNeedsStdin("python", 'age = int(input("age: "))')).toBe(true)
    expect(codeNeedsStdin("py", "line = sys.stdin.readline()")).toBe(true)
    expect(codeNeedsStdin("javascript", 'const n = prompt("n?")')).toBe(true)
    expect(codeNeedsStdin("java", "Scanner sc = new Scanner(System.in);")).toBe(true)
    expect(codeNeedsStdin("cpp", "cin >> n;")).toBe(true)
    expect(codeNeedsStdin("go", "fmt.Scan(&n)")).toBe(true)
    expect(codeNeedsStdin("ruby", "name = gets")).toBe(true)
    expect(codeNeedsStdin("python", "print(sum([1, 2, 3]))")).toBe(false)
    expect(codeNeedsStdin("python", "# input() would read a line")).toBe(false)
  })
  it("is false for non-runnable and stdin-free languages", () => {
    expect(codeNeedsStdin("text", "input()")).toBe(false)
    expect(codeNeedsStdin("sql", "SELECT 1")).toBe(false)
    expect(codeNeedsStdin(null, "input()")).toBe(false)
  })
  it("counts reads for the placeholder hint", () => {
    expect(countStdinReads("python", 'a = input()\nb = input()')).toBe(2)
    expect(countStdinReads("python", "print(1)")).toBe(0)
    // Shared RegExp objects must stay lastIndex-clean across calls.
    expect(countStdinReads("python", 'input()\ninput()')).toBe(2)
    expect(codeNeedsStdin("python", 'input("a")')).toBe(true)
  })
})

describe("preflightStdinError", () => {
  it("explains the fix instead of letting the runner return EOFError", () => {
    const msg = preflightStdinError("python", 'age = int(input("Enter your age: "))', "")
    expect(msg).toMatch(/asks for input/i)
    expect(msg).toMatch(/Values your program reads/)
  })
  it("is silent when input is supplied, absent, or handled", () => {
    expect(preflightStdinError("python", "input()", "20")).toBeNull()
    expect(preflightStdinError("python", "print(1)", "")).toBeNull()
    expect(preflightStdinError("python", "try:\n    input()\nexcept EOFError:\n    print('none')", "")).toBeNull()
  })
  it("blocks the run before spending a runner call", async () => {
    const fetchSpy = okFetch({})
    const res = await runCode("python", 'age = int(input("age: "))', "", fetchSpy)
    expect(res.ok).toBe(false)
    expect(res.ok === false && res.error).toMatch(/asks for input/i)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
  it("runs normally once values are provided", async () => {
    const fetchSpy = okFetch({ status: "0", program_output: "You are eligible to vote", program_error: "" })
    const res = await runCode("python", 'age = int(input("age: "))', "20", fetchSpy)
    expect(res.ok).toBe(true)
    expect(res.ok === true && res.stdout).toBe("You are eligible to vote")
    expect(fetchSpy).toHaveBeenCalledOnce()
  })
})

describe("firstErrorLine", () => {
  it("reads the failing line out of real tracebacks", () => {
    expect(
      firstErrorLine('Traceback (most recent call last):\n  File "/home/wandbox/prog.py", line 2, in <module>\n    age = int(input("Enter your age: "))\nValueError: invalid literal')
    ).toBe(2)
    expect(firstErrorLine("prog.cc:12:5: error: expected ';'")).toBe(12)
    expect(firstErrorLine("    at Object.<anonymous> (/home/wandbox/prog.js:7:9)")).toBe(7)
    expect(firstErrorLine("prog.go:19:2: undefined: x")).toBe(19)
    expect(firstErrorLine("thread 'main' panicked at src/main.rs:33:5")).toBe(33)
    expect(firstErrorLine("Exception in thread main java.lang.NullPointerException\n\tat App.java:14")).toBe(14)
  })
  it("prefers the innermost frame and ignores non-tracebacks", () => {
    expect(
      firstErrorLine('  File "/home/wandbox/prog.py", line 9, in inner\nValueError\n  File "/home/wandbox/prog.py", line 4, in outer')
    ).toBe(4)
    expect(firstErrorLine("")).toBeNull()
    expect(firstErrorLine("You are eligible to vote")).toBeNull()
  })
})
