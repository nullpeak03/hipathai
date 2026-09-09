import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  // Offline-first lessons: static + app documents cached, quiz queue syncs via localStorage.
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.(png|jpg|jpeg|svg|ico|woff2?)$/i,
        handler: "CacheFirst",
        options: { cacheName: "static-assets" },
      },
      {
        urlPattern: ({ url }: { url: URL }) =>
          url.pathname.startsWith("/app/roadmap") ||
          url.pathname.startsWith("/app/lesson") ||
          url.pathname.startsWith("/offline"),
        handler: "NetworkFirst",
        options: { cacheName: "lesson-pages", networkTimeoutSeconds: 5 },
      },
      {
        urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/api/roadmaps/"),
        handler: "NetworkFirst",
        options: { cacheName: "roadmap-api", networkTimeoutSeconds: 5 },
      },
    ],
  },
})(nextConfig);
