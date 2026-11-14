import { describe, expect, it, vi } from "vitest"
import {
  deleteTutorImagesForUser,
  toObjectPaths,
  type TutorImageStorage,
} from "./tutor-image-cleanup"

function makeStorage(pages: { name: string }[][], failOn?: "list" | "remove") {
  const list = vi.fn(async (_prefix: string, opts: { limit: number; offset: number }) => {
    if (failOn === "list") return { data: null, error: { message: "list failed" } }
    const index = Math.floor(opts.offset / opts.limit)
    return { data: pages[index] ?? [], error: null }
  })
  const remove = vi.fn(async () => {
    if (failOn === "remove") return { error: { message: "remove failed" } }
    return { error: null }
  })
  const storage: TutorImageStorage = { from: () => ({ list, remove }) }
  return { storage, list, remove }
}

describe("deleteTutorImagesForUser", () => {
  it("deletes every object under the owner folder", async () => {
    const { storage, remove } = makeStorage([[{ name: "1-a.png" }, { name: "2-b.jpg" }]])
    await expect(deleteTutorImagesForUser(storage, "user_1")).resolves.toEqual({
      ok: true,
      deleted: 2,
    })
    expect(remove).toHaveBeenCalledWith(["user_1/1-a.png", "user_1/2-b.jpg"])
  })

  it("walks multiple pages until a short page", async () => {
    const first = Array.from({ length: 100 }, (_, i) => ({ name: `${i}.png` }))
    const { storage, remove } = makeStorage([first, [{ name: "tail.png" }]])
    await expect(
      deleteTutorImagesForUser(storage, "user_1", { pageSize: 100 })
    ).resolves.toEqual({ ok: true, deleted: 101 })
    expect(remove).toHaveBeenCalledTimes(2)
  })

  it("reports list and removal failures without throwing", async () => {
    const listFail = makeStorage([], "list")
    await expect(deleteTutorImagesForUser(listFail.storage, "u")).resolves.toEqual({
      ok: false,
      deleted: 0,
      error: "list failed",
    })

    const removeFail = makeStorage([[{ name: "a.png" }]], "remove")
    await expect(deleteTutorImagesForUser(removeFail.storage, "u")).resolves.toEqual({
      ok: false,
      deleted: 0,
      error: "remove failed",
    })
  })

  it("stops after maxPages instead of looping forever", async () => {
    const full = Array.from({ length: 2 }, (_, i) => ({ name: `${i}.png` }))
    const { storage } = makeStorage([full, full, full])
    const result = await deleteTutorImagesForUser(storage, "u", { pageSize: 2, maxPages: 3 })
    expect(result.ok).toBe(false)
    expect(result.deleted).toBe(6)
  })

  it("is a no-op for a user with no uploads", async () => {
    const { storage, remove } = makeStorage([[]])
    await expect(deleteTutorImagesForUser(storage, "u")).resolves.toEqual({ ok: true, deleted: 0 })
    expect(remove).not.toHaveBeenCalled()
  })
})

describe("toObjectPaths", () => {
  it("skips folders and traversal names", () => {
    expect(
      toObjectPaths("u", [{ name: "ok.png" }, { name: "" }, { name: "." }, { name: "nested/" }])
    ).toEqual(["u/ok.png"])
  })

  it("tolerates a null page", () => {
    expect(toObjectPaths("u", null)).toEqual([])
  })
})
