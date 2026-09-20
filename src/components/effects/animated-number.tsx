"use client"
import { useCountUp } from "@/lib/motion"

/** Number that tweens to its target (instant under reduced motion). */
export function AnimatedNumber({
  value,
  format,
}: {
  value: number
  format?: (n: number) => string
}) {
  const display = useCountUp(value)
  return <>{format ? format(display) : display}</>
}
