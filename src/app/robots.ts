import type { MetadataRoute } from "next"

// NOTE: "/roadmap$" + "/roadmap/" (not bare "/roadmap") — a bare prefix
// would also swallow the PUBLIC library at /roadmaps via prefix matching.
// Longest-match wins: /roadmaps/* hits only Allow, /roadmap* hits Disallow.
//
// /start/* is deliberately NOT disallowed: Clerk middleware 307s anonymous
// visitors to /sign-in, so crawlers see a redirect. Blocking it only produced
// "Blocked by robots.txt" errors for the "Start This Roadmap" links that every
// public roadmap page renders.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/roadmaps/"],
        disallow: ["/api/", "/dashboard", "/roadmap$", "/roadmap/", "/tutor", "/code-e", "/analytics", "/settings", "/onboarding"],
      },
    ],
    sitemap: "https://www.hipathai.me/sitemap.xml",
  }
}
