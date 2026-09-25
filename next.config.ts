import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "img.clerk.com" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
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
