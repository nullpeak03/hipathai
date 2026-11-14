import { defaultCache } from "@serwist/next/worker"
import { NetworkOnly, Serwist, type PrecacheEntry, type RuntimeCaching } from "serwist"
import { isUncacheableApiRequest } from "../lib/sw-routing"

declare global {
  // Precache manifest injected at build time by the Serwist webpack plugin
  // (it scans for the literal self.__SW_MANIFEST reference).
  interface Window {
    __SW_MANIFEST?: (PrecacheEntry | string)[]
  }
}

// API responses are user-scoped. Put this rule before defaultCache so no
// default rule can capture /api/** — otherwise a shared device can serve one
// learner's cached progress/chat response to the next signed-in user.
const apiNetworkOnly: RuntimeCaching = {
  matcher: ({ url, sameOrigin }) => isUncacheableApiRequest(url.pathname, sameOrigin),
  handler: new NetworkOnly(),
}

// Shell + cached reads offline (Phase 1): precached app shell, runtime
// strategies for pages/assets, document fallback to /offline. API POSTs are
// never cached; every /api/** request (GET included) stays network-only.
// Writes (quiz submits, progress sync) require connectivity by design.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [apiNetworkOnly, ...defaultCache],
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
