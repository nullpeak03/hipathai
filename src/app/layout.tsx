import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { GuidanceBox } from "@/components/guidance/guidance-box";
import { PreferencesApplier } from "@/components/preferences/preferences-applier";
import { RegisterSW } from "@/components/pwa/register-sw";
import { ClerkProvider } from "@clerk/nextjs"
import { FOUNDER } from "@/lib/founder"

/**
 * Captures beforeinstallprompt the instant it fires — it is a one-shot
 * event that often lands BEFORE React hydrates (manifest + worker are
 * cached from prior visits), so a useEffect listener alone always misses it.
 * Stashed on window for useInstallPrompt() to pick up on mount.
 */
const INSTALL_CAPTURE_SCRIPT = `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__hipathInstallPrompt=e;if(window.console&&console.info)console.info('[pwa] install prompt captured');});window.addEventListener('appinstalled',function(){window.__hipathInstallPrompt=null;if(window.console&&console.info)console.info('[pwa] app installed');});`

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
  // No site-wide canonical here: each page declares its own via
  // `pageMetadata()` in src/lib/metadata.ts. A root canonical makes every
  // page without metadata claim the homepage and be treated as a duplicate.
  title: {
    default: "HiPath AI — Your Personal AI Learning Navigator",
    template: "%s · HiPath AI",
  },
  description: "HiPath AI builds you a personalized roadmap, teaches every lesson with runnable code in an 18-language editor, adapts to your weaknesses, and keeps you motivated — like having a mentor in your pocket.",
  authors: [{ name: FOUNDER.name, url: FOUNDER.linkedin }],
  creator: FOUNDER.name,
  openGraph: {
    type: "website",
    siteName: "HiPath AI",
    title: "HiPath AI — Your Personal AI Learning Navigator",
    description: "Personalized AI roadmaps, an 18-language code editor, mastery tracking, adaptive quizzes, and a mentor that remembers your progress.",
  },
  twitter: {
    card: "summary_large_image",
    title: "HiPath AI — Your Personal AI Learning Navigator",
    description: "Personalized AI roadmaps, an 18-language code editor, mastery tracking, adaptive quizzes, and a mentor that remembers your progress.",
  },
  robots: { index: true, follow: true },
  appleWebApp: { capable: true, title: "HiPath AI", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Script id="pwa-install-capture" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: INSTALL_CAPTURE_SCRIPT }} />
        <RegisterSW />
        <ClerkProvider>
          <Providers>{children}</Providers>
        <PreferencesApplier />
        <GuidanceBox />
        </ClerkProvider>
      </body>
    </html>
  )
}
