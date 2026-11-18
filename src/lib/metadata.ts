import type { Metadata } from "next"

export const SITE_URL = "https://www.hipathai.me"
export const SITE_NAME = "HiPath AI"

/**
 * The generated 1200×630 share card from `src/app/opengraph-image.tsx`.
 *
 * Next inherits file-convention images into the layout's metadata, but a page
 * that declares its own `openGraph` object replaces the inherited one — which
 * silently dropped `og:image`/`twitter:image` on every page using this helper.
 * Declaring the image here keeps all pages on the same card.
 */
export const SOCIAL_IMAGE = {
  url: `${SITE_URL}/opengraph-image`,
  width: 1200,
  height: 630,
} as const

type PageMetadataOptions = {
  /** Page title without the site suffix; the root template adds " · HiPath AI". */
  title: string
  description: string
  /** Root-relative path, e.g. "/pricing". */
  path: `/${string}`
  type?: "website" | "article"
  /** Set for the home page so the template does not append the site name twice. */
  absoluteTitle?: boolean
  noIndex?: boolean
}

/** Bing's Webmaster Tools flags titles longer than ~70 characters. */
export const TITLE_MAX = 65
const TITLE_SUFFIX = ` · ${SITE_NAME}`

/**
 * Trim a generated title so the rendered `<title>` (this text plus
 * " · HiPath AI") stays inside the limit. Cuts on a word boundary.
 */
export function fitTitle(text: string, max = TITLE_MAX - TITLE_SUFFIX.length): string {
  const clean = text.trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const boundary = cut.replace(/\s+\S*$/, "").trim()
  return `${boundary || cut.trimEnd()}…`
}

/**
 * Public roadmap titles read like article headlines: "Machine Learning
 * Fundamentals: Hands-On Hobbyist Path". Search results truncate them, so keep
 * the query-shaped part before the colon and drop the subtitle.
 *
 * All seven public roadmaps land at 36–61 rendered characters after this.
 */
export function roadmapLabel(title: string): string {
  const base = title.split(/[:—–|]/)[0].trim()
  const label = /roadmap$/i.test(base) ? base : `${base} Roadmap`
  return fitTitle(label)
}

/**
 * One place for per-page SEO metadata. The root layout must NOT set a
 * canonical, otherwise pages without their own metadata claim the homepage
 * as their canonical URL and search engines treat them as duplicates.
 */
export function pageMetadata({
  title,
  description,
  path,
  type = "website",
  absoluteTitle = false,
  noIndex = false,
}: PageMetadataOptions): Metadata {
  const canonical = path === "/" ? SITE_URL : `${SITE_URL}${path}`
  const socialTitle = absoluteTitle ? title : `${title} · ${SITE_NAME}`

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical },
    openGraph: {
      title: socialTitle,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type,
      images: [{ ...SOCIAL_IMAGE, alt: socialTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [SOCIAL_IMAGE.url],
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  }
}
