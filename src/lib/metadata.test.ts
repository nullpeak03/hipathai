import { describe, expect, it } from "vitest"
import { pageMetadata, SITE_URL, SOCIAL_IMAGE } from "./metadata"

describe("pageMetadata", () => {
  it("builds the canonical from the site URL", () => {
    expect(pageMetadata({ title: "Pricing", description: "d", path: "/pricing" }).alternates?.canonical).toBe(
      `${SITE_URL}/pricing`
    )
    expect(pageMetadata({ title: "Home", description: "d", path: "/" }).alternates?.canonical).toBe(SITE_URL)
  })

  it("appends the site name to social titles unless absolute", () => {
    expect(pageMetadata({ title: "Pricing", description: "d", path: "/pricing" }).openGraph?.title).toBe(
      "Pricing · HiPath AI"
    )
    expect(
      pageMetadata({ title: "HiPath AI", description: "d", path: "/", absoluteTitle: true }).openGraph?.title
    ).toBe("HiPath AI")
  })

  // Regression: declaring `openGraph` replaced the layout's file-convention
  // image, so every page using this helper shipped without og:image.
  it("always carries the social image", () => {
    const meta = pageMetadata({ title: "Guides", description: "d", path: "/guides", type: "article" })
    expect(meta.openGraph?.images).toEqual([{ ...SOCIAL_IMAGE, alt: "Guides · HiPath AI" }])
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", images: [SOCIAL_IMAGE.url] })
  })

  it("only emits robots when noIndex is set", () => {
    expect(pageMetadata({ title: "t", description: "d", path: "/x" }).robots).toBeUndefined()
    expect(pageMetadata({ title: "t", description: "d", path: "/x", noIndex: true }).robots).toEqual({
      index: false,
      follow: true,
    })
  })
})
