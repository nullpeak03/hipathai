import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.hipathai.me"),
  title: "HiPath AI — learn_to_ship()",
  description:
    "Tech-only learning OS: roadmaps, lessons, quiz-gated progression, Socratic tutor, GitHub project reviews.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#050A08",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const body = (
    <body className="min-h-full flex flex-col">
      <div className="bg-[#050A08] text-[#E6F4ED] min-h-screen flex flex-col flex-1">
        {children}
      </div>
    </body>
  );
  // Build/preview without keys renders unprotected shell; real auth activates with envs
  if (!clerkKey) {
    return (
      <html
        lang="en"
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
      >
        {body}
      </html>
    );
  }
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <ClerkProvider
        appearance={{
          variables: { colorPrimary: "#10B981", colorBackground: "#050A08" },
        }}
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
      >
        {body}
      </ClerkProvider>
    </html>
  );
}
