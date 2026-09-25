import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ClerkProvider } from "@clerk/nextjs"

export const viewport: Viewport = {
  themeColor: "#6c5bff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.hipathai.me"),
  alternates: { canonical: "https://www.hipathai.me/" },
  title: {
    default: "HiPath AI — Your Personal AI Learning Navigator",
    template: "%s · HiPath AI",
  },
  description: "HiPath AI builds you a personalized roadmap, guides you day by day with AI tutoring, adapts to your weaknesses, and keeps you motivated — like having a mentor in your pocket.",
  openGraph: {
    type: "website",
    siteName: "HiPath AI",
    title: "HiPath AI — Your Personal AI Learning Navigator",
    description: "Personalized AI roadmaps, adaptive quizzes, and a mentor that remembers your progress.",
  },
  twitter: {
    card: "summary_large_image",
    title: "HiPath AI — Your Personal AI Learning Navigator",
    description: "Personalized AI roadmaps, adaptive quizzes, and a mentor that remembers your progress.",
  },
  robots: { index: true, follow: true },
  appleWebApp: { capable: true, title: "HiPath AI", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <Providers>{children}</Providers>
        </ClerkProvider>
      </body>
    </html>
  )
}
