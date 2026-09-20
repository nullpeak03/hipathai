import type { MetadataRoute } from "next"

const PAGES = ["", "/privacy", "/terms", "/cookies", "/contact", "/sign-in", "/sign-up"]

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.hipathai.me"
  const now = new Date()
  return PAGES.map((p) => ({
    url: `${base}${p || "/"}`,
    lastModified: now,
    changeFrequency: p === "" ? "daily" : "monthly",
    priority: p === "" ? 1 : 0.5,
  }))
}
