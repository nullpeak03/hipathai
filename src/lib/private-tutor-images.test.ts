import { describe, expect, it } from "vitest"
import { parseOwnedTutorImagePaths } from "./private-tutor-images"

describe("parseOwnedTutorImagePaths", () => {
  it("allows empty image lists for text-only chat", () => {
    expect(parseOwnedTutorImagePaths([], "user_1")).toEqual({ ok: true, paths: [] })
  })

  it("accepts only paths owned by the authenticated user", () => {
    expect(parseOwnedTutorImagePaths(["user_1/123-screenshot.png"], "user_1")).toEqual({
      ok: true,
      paths: ["user_1/123-screenshot.png"],
    })
    expect(parseOwnedTutorImagePaths(["user_2/123-screenshot.png"], "user_1")).toMatchObject({ ok: false, status: 400 })
  })

  it("rejects URLs and traversal-like paths", () => {
    expect(parseOwnedTutorImagePaths(["https://example.com/image.png"], "user_1")).toMatchObject({ ok: false, status: 400 })
    expect(parseOwnedTutorImagePaths(["user_1/../user_2/image.png"], "user_1")).toMatchObject({ ok: false, status: 400 })
  })

  it("requires authentication and caps the number of images", () => {
    expect(parseOwnedTutorImagePaths(["user_1/image.png"], null)).toMatchObject({ ok: false, status: 401 })
    expect(parseOwnedTutorImagePaths(Array.from({ length: 5 }, (_, i) => `user_1/${i}.png`), "user_1"))
      .toMatchObject({ ok: false, status: 400 })
  })
})
