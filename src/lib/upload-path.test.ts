import { describe, expect, it } from "vitest"
import {
  buildTutorImagePath,
  extensionForContentType,
  MAX_UPLOAD_FILE_NAME_CHARS,
  safeFileNameStem,
} from "./upload-path"

describe("tutor image paths", () => {
  it("maps every allowed content type to a real extension", () => {
    expect(extensionForContentType("image/png")).toBe("png")
    expect(extensionForContentType("image/jpeg")).toBe("jpg")
    expect(extensionForContentType("image/webp")).toBe("webp")
    expect(extensionForContentType("image/gif")).toBe("gif")
    expect(extensionForContentType("image/svg+xml")).toBeNull()
    expect(extensionForContentType("application/pdf")).toBeNull()
  })

  it("keeps the object under the owner's folder with a server-chosen extension", () => {
    expect(
      buildTutorImagePath({
        userId: "user_abc",
        fileName: "shot.PNG",
        contentType: "image/png",
        now: 1_700_000_000_000,
        nonce: "abcd1234",
      })
    ).toBe("user_abc/1700000000000-abcd1234-shot.png")
  })

  it("does not double up the extension when the name already has one", () => {
    const path = buildTutorImagePath({
      userId: "u", fileName: "error.png", contentType: "image/jpeg",
      now: 1, nonce: "n",
    })
    expect(path).toBe("u/1-n-error.jpg")
  })

  it("strips directories so a name cannot escape the user folder", () => {
    const path = buildTutorImagePath({
      userId: "u", fileName: "../../other-user/secret.png", contentType: "image/png",
      now: 1, nonce: "n",
    })
    expect(path).toBe("u/1-n-secret.png")
    expect(path.split("/")).toHaveLength(2)
  })

  it("bounds the name length", () => {
    const path = buildTutorImagePath({
      userId: "u", fileName: "x".repeat(500) + ".png", contentType: "image/png",
      now: 1, nonce: "n",
    })
    const stem = path.split("/")[1]!.replace(/^1-n-/, "").replace(/\.png$/, "")
    expect(stem).toHaveLength(MAX_UPLOAD_FILE_NAME_CHARS)
    expect(path.length).toBeLessThan(512)
  })

  it("falls back to a usable stem for empty, non-string, or symbol-only names", () => {
    expect(safeFileNameStem(undefined)).toBe("image")
    expect(safeFileNameStem(42)).toBe("image")
    expect(safeFileNameStem("")).toBe("image")
    expect(safeFileNameStem("...")).toBe("image")
    expect(safeFileNameStem("///")).toBe("image")
    expect(safeFileNameStem("日本語.png")).toBe("image")
  })

  it("refuses unsupported content types instead of trusting the client", () => {
    expect(() =>
      buildTutorImagePath({ userId: "u", fileName: "x.png", contentType: "text/html" })
    ).toThrow(/Unsupported content type/)
  })
})
