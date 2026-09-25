// Post-auth routing decisions (client-safe; no server imports).
// Returning users with a roadmap land on the dashboard, everyone else
// goes through onboarding.

export type PostAuthTarget = "/dashboard" | "/onboarding"

/** Where a freshly authenticated user belongs based on roadmap existence. */
export function postAuthTarget(hasRoadmap: boolean): PostAuthTarget {
  return hasRoadmap ? "/dashboard" : "/onboarding"
}

/**
 * Explicit wizard intent bypasses the existing-roadmap guard:
 * ?edit=<id> (roadmap Edit flow) or ?new=1 (deliberate fresh start).
 */
export function isExplicitOnboardingIntent(
  edit: string | null,
  fresh: string | null
): boolean {
  return !!edit || fresh === "1"
}
