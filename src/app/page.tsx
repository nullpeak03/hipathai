import { LandingPage } from "@/components/landing/landing-page"

export const dynamic = "force-dynamic"

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
        description: "Personalized AI learning roadmaps with adaptive quizzes and a persistent AI tutor for computer science and technology.",
      },
    ],
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}

export const metadata = {
  other: {
    "indiefounders-site-verification": "0fe40e9b5690bc614ffd5261fca7ef1a24648d68e2113773c04d269143787c80",
  },
}

export default function Landing() {
  return (
    <>
      <StructuredData />
      <LandingPage />
    </>
  )
}
