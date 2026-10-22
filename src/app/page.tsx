import { LandingDemo } from "@/components/landing/landing-demo"

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

export default function Landing() {
  return (
    <>
      <StructuredData />
      <LandingDemo />
    </>
  )
}
