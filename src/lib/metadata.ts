import type { Metadata } from "next"

export const SITE_URL = "https://www.hipathai.me"
export const SITE_NAME = "HiPath AI"

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
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  }
}
