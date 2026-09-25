import { defaultCache } from "@serwist/next/worker"
import { Serwist, type PrecacheEntry } from "serwist"

declare global {
  // Precache manifest injected at build time by the Serwist webpack plugin
  // (it scans for the literal self.__SW_MANIFEST reference).
  interface Window {
    __SW_MANIFEST?: (PrecacheEntry | string)[]
  }
}

// Shell + cached reads offline (Phase 1): precached app shell, runtime
// strategies for pages/assets, document fallback to /offline. API POSTs are
// never cached; GET APIs go network-first with a short cache. Writes
// (quiz submits, progress sync) require connectivity by design.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }: { request: Request }) => request.destination === "document",
      },
    ],
  },
})

serwist.addEventListeners()
