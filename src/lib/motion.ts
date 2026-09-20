"use client"
import { useEffect, useRef, useState } from "react"
import { useReducedMotion as useMotionReducedMotion } from "framer-motion"
import type { Variants } from "framer-motion"

// Shared motion vocabulary — subtle and professional. Every animated surface
// consumes these (no ad-hoc durations/easings), and everything respects the
// reduced-motion gate.

export function usePrefersReducedMotion(): boolean {
  return useMotionReducedMotion() ?? false
}

/** Entrance: gentle rise + fade. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
}

/** Parent for staggered children. */
export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}

/** Child of a stagger parent. */
export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
}

/** Button press spring. */
export const pressTap = { whileTap: { scale: 0.97 } } as const

/** Animated integer count-up. Freezes instantly under reduced motion. */
export function useCountUp(target: number, durationMs = 800): number {
  const reduce = usePrefersReducedMotion()
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  useEffect(() => {
    if (reduce) {
      setValue(target)
      return
    }
    const from = fromRef.current
    if (from === target) {
      setValue(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(from + (target - from) * eased))
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        fromRef.current = target
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs, reduce])
  return value
}
