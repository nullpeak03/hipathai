"use client"
import { motion } from "framer-motion"
import { ringGeometry } from "@/lib/ring"

/**
 * Animated progress ring. Theme-aware via currentColor + muted track —
 * works on any surface without hardcoded colors.
 */
export function ProgressRing({ pct, size = 64, stroke = 7, label }: {
  pct: number
  size?: number
  stroke?: number
  label?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const { circumference, offset } = ringGeometry(r, pct)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(pct)}% complete`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      {label !== undefined ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">{label}</div>
      ) : null}
    </div>
  )
}
