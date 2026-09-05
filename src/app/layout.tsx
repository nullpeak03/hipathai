import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HiPath AI - Adaptive Learning Platform",
  description: "Generate personalized learning roadmaps, detect weaknesses, and master new skills with AI-powered adaptive learning.",
  icons: {
    icon: [
      { url: "/hipath-ai-icon.png?v=2", type: "image/png", sizes: "1024x1024" },
      { url: "/icon.png?v=2", type: "image/png", sizes: "1024x1024" },
    ],
    shortcut: "/hipath-ai-icon.png?v=2",
    apple: "/apple-icon.png?v=2",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#101828" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
