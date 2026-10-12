"use client"
import { useEffect, useState } from "react"

const COLORS = ["#6C5BFF", "#10b981", "#f59e0b", "#ec4899", "#38bdf8"]
const PIECES = 26

/**
 * One-shot celebration burst. Mounts (or re-fires when `fireKey` changes),
 * plays ~1.1s, then unmounts itself. Renders nothing under reduced motion
 * (the global CSS kill switch) or when hidden.
 */
export function ConfettiBurst({ fireKey }: { fireKey: string | number | boolean }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!fireKey) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 1400)
    return () => clearTimeout(t)
  }, [fireKey])

  if (!visible) return null
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-visible z-10">
      {Array.from({ length: PIECES }, (_, i) => {
        const dx = ((i * 53) % 220) - 110
        const dy = 60 + ((i * 37) % 140)
        const delay = (i % 7) * 40
        const round = i % 3 === 0
        return (
          <span
            key={i}
            className="confetti-piece"
            style={{
              ["--dx" as string]: `${dx}px`,
              ["--dy" as string]: `${dy}px`,
              background: COLORS[i % COLORS.length],
              borderRadius: round ? "50%" : 2,
              animationDelay: `${delay}ms`,
            }}
          />
        )
      })}
    </div>
  )
}
