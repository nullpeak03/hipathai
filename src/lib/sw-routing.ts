/**
 * Service-worker routing predicates.
 *
 * Kept in a plain module so the rules can be unit-tested; `src/app/sw.ts`
 * runs in the worker and is not importable from Vitest.
 */

/**
 * API responses are user-scoped (progress, roadmaps, chat, entitlement) and
 * must never enter a cache. On a shared device a cached `/api/me/*` response
 * could otherwise be served to the next signed-in learner, and stale data can
 * mask fresh server state.
 */
export function isUncacheableApiRequest(pathname: string, sameOrigin: boolean): boolean {
  return sameOrigin && pathname.startsWith("/api/")
}
