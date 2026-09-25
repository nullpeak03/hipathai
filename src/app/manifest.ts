import type { MetadataRoute } from "next"

/** Web app manifest — makes HiPath AI installable (PWA). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HiPath AI — Personal AI Learning Navigator",
    short_name: "HiPath AI",
    description:
      "Personalized AI learning roadmaps with adaptive quizzes and a persistent AI tutor.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#6c5bff",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
