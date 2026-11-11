import type { Metadata } from "next"
import { LandingPage } from "@/components/landing/landing-page"
import { FOUNDER } from "@/lib/founder"
import { pageMetadata, SITE_NAME } from "@/lib/metadata"
import { getPublicProof } from "@/lib/public-proof-server"

export const dynamic = "force-dynamic"

const HOME_TITLE = `${SITE_NAME} — Your Personal AI Learning Navigator`
const HOME_DESCRIPTION =
  "HiPath AI builds you a personalized roadmap, teaches every lesson with runnable code in an 18-language editor, adapts to your weaknesses, and keeps you motivated — like having a mentor in your pocket."

function StructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "HiPath AI",
        url: "https://www.hipathai.me/",
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        author: {
          "@type": "Person",
          name: FOUNDER.name,
          jobTitle: FOUNDER.role,
          url: FOUNDER.linkedin,
        },
        description: "Personalized AI learning roadmaps with runnable lessons, an 18-language code editor, mastery tracking, adaptive quizzes, and a persistent AI tutor for computer science and technology.",
      },
    ],
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}

export const metadata: Metadata = {
  ...pageMetadata({
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    path: "/",
    absoluteTitle: true,
  }),
  other: {
    "indiefounders-site-verification": "0fe40e9b5690bc614ffd5261fca7ef1a24648d68e2113773c04d269143787c80",
  },
}

export default async function Landing() {
  const proof = await getPublicProof()
  return (
    <>
      <StructuredData />
      <LandingPage proof={proof.metrics} />
    </>
  )
}
