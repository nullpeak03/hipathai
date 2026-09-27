/**
 * Ambient backdrop: edge color washes + whisper tech-doodle field.
 * Static (no listeners, no animation) — renders identically server and
 * client. Parent must be `relative`; cards stay opaque so the wash only
 * ever shows in gutters. Theme colors come from --ambient-* tokens.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 ambient-washes" />
      <div className="absolute inset-0 ambient-doodles" />
    </div>
  )
}
