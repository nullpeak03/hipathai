/** Shared public navigation. Keep the landing header and the marketing shell in sync. */
export type MarketingLink = {
  href: string
  label: string
  /** Hash links stay on the landing page section. */
  anchor?: boolean
}

export const MARKETING_LINKS: MarketingLink[] = [
  { href: "/#how-you-learn", label: "How you learn", anchor: true },
  { href: "/#mentor", label: "Mentor", anchor: true },
  { href: "/#code-editor", label: "Code editor", anchor: true },
  { href: "/roadmaps", label: "Library" },
  { href: "/guides", label: "Guides" },
  { href: "/pricing", label: "Pricing" },
]

export const FOOTER_GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/#how-you-learn", label: "How you learn" },
      { href: "/#mentor", label: "AI mentor" },
      { href: "/#code-editor", label: "Code editor" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/roadmaps", label: "Roadmap library" },
      { href: "/guides", label: "Guides" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/changelog", label: "Changelog" },
      { href: "/product-roadmap", label: "Product roadmap" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/cookies", label: "Cookies" },
      { href: "/refund", label: "Refund policy" },
    ],
  },
]
