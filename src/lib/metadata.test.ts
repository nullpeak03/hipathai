import { describe, expect, it } from "vitest"
import { fitTitle, pageMetadata, roadmapLabel, SITE_URL, SOCIAL_IMAGE, TITLE_MAX } from "./metadata"

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

describe("fitTitle", () => {
  it("leaves a title that already fits untouched", () => {
    expect(fitTitle("Data Structures That Actually Stick")).toBe("Data Structures That Actually Stick")
  })

  it("cuts on a word boundary and stays inside the rendered limit", () => {
    const raw = "AI Agent Developer with Python: From Foundations to Autonomous Systems"
    const fitted = fitTitle(raw)
    expect(fitted.length).toBeLessThanOrEqual(TITLE_MAX - " · HiPath AI".length)
    expect(fitted.endsWith("…")).toBe(true)
    expect(fitted).not.toMatch(/\s…$/)
    expect(raw.startsWith(fitted.slice(0, -1).trimEnd())).toBe(true)
  })
})

describe("roadmapLabel", () => {
  // Every public roadmap in production, as of 2026-11-18.
  const rows = [
    ["AI Agent Developer with Python: From Foundations to Autonomous Systems", "AI Agent Developer with Python Roadmap"],
    ["Arduino Hobbyist Roadmap: From Blink to IoT", "Arduino Hobbyist Roadmap"],
    ["Azure Databricks Data Engineering Mastery Roadmap", "Azure Databricks Data Engineering Mastery Roadmap"],
    ["Data Engineering Fundamentals: From Pipelines to Production", "Data Engineering Fundamentals Roadmap"],
    ["Machine Learning Fundamentals: Hands-On Hobbyist Path", "Machine Learning Fundamentals Roadmap"],
    ["Full Stack Python Developer Roadmap: Next.js Frontend & Python Backend", "Full Stack Python Developer Roadmap"],
    ["Full Stack Software Developer Roadmap", "Full Stack Software Developer Roadmap"],
  ] as const

  it.each(rows)("turns %s into a title Bing will not truncate", (raw, expected) => {
    const label = roadmapLabel(raw)
    expect(label).toBe(expected)
    expect(`${label} · HiPath AI`.length).toBeLessThanOrEqual(TITLE_MAX)
  })
})
