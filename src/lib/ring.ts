/** Circumference for r, and the dash offset that renders `pct` (0-100). Pure math, unit-tested. */
export function ringGeometry(r: number, pct: number): { circumference: number; offset: number } {
  const clamped = Math.max(0, Math.min(100, pct))
  const circumference = 2 * Math.PI * r
  return { circumference, offset: circumference - (clamped / 100) * circumference }
}
