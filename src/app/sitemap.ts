import type { MetadataRoute } from "next"
import { createServerClient } from "@/lib/supabase/server"

const BASE = "https://www.hipathai.me"
const PAGES = ["", "/privacy", "/terms", "/cookies", "/contact", "/sign-in", "/sign-up", "/about", "/roadmaps"]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticPages: MetadataRoute.Sitemap = PAGES.map((p) => ({
    url: `${BASE}${p || "/"}`,
    lastModified: now,
    changeFrequency: p === "" ? "daily" : "monthly",
    priority: p === "" ? 1 : p === "/roadmaps" ? 0.9 : 0.5,
  }))
  // Public library entries (empty pre-migration — never fail the sitemap).
  try {
    const supabase = createServerClient()
    const { data } = await supabase
      .from("public_roadmaps")
      .select("slug,published_at")
      .order("published_at", { ascending: false })
      .limit(500)
    const rows = ((data ?? []) as { slug: string; published_at: string }[]).filter((r) =>
      /^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug)
    )
    return [
      ...staticPages,
      ...rows.map((r) => ({
        url: `${BASE}/roadmaps/${r.slug}`,
        lastModified: new Date(r.published_at),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ]
  } catch {
    return staticPages
  }
}
