import type { MetadataRoute } from "next"

// NOTE: "/roadmap$" + "/roadmap/" (not bare "/roadmap") — a bare prefix
// would also swallow the PUBLIC library at /roadmaps via prefix matching.
// Longest-match wins: /roadmaps/* hits only Allow, /roadmap* hits Disallow.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/roadmaps/"],
        disallow: ["/api/", "/dashboard", "/roadmap$", "/roadmap/", "/start", "/tutor", "/analytics", "/settings", "/onboarding"],
      },
    ],
    sitemap: "https://www.hipathai.me/sitemap.xml",
  }
}
