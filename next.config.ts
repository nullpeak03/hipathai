import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

function getOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

const supabaseOrigin = getOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
const posthogOrigin = getOrigin(process.env.NEXT_PUBLIC_POSTHOG_HOST);
const connectSources = [
  "'self'",
  "https://clerk.hipathai.me",
  "https://*.clerk.com",
  "https://*.clerk.accounts.dev",
  "wss://*.clerk.com",
  "wss://*.clerk.accounts.dev",
  supabaseOrigin,
  supabaseOrigin?.replace(/^https:/, "wss:"),
  posthogOrigin,
].filter((source): source is string => Boolean(source));

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://*.clerk.com https://*.clerk.accounts.dev https://clerk.hipathai.me",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://img.clerk.com https://*.supabase.co",
  "font-src 'self' data:",
  `connect-src ${[...new Set(connectSources)].join(" ")}`,
  "frame-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://accounts.google.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "img.clerk.com" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ]
  },
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Manual registration via <RegisterSW/> — the plugin's auto mode shipped
  // zero registration code (verified in served HTML: no SW hookup at all).
  register: false,
  // No service worker in dev — avoids stale-cache pain while developing.
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
