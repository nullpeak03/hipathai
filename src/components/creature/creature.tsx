"use client"
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

type Expression = "neutral" | "happy" | "sad"

type CreatureProps = {
  mode?: "float" | "burst"
  message?: string
  open?: boolean
  onClose?: () => void
  expression?: Expression
}

const BLINK_INTERVAL_MS = 3200

export function Creature({ mode = "float", message, open = true, onClose, expression = "neutral" }: CreatureProps) {
  const [visible, setVisible] = useState(open)
  const [blinking, setBlinking] = useState(false)

  useEffect(() => setVisible(open), [open])

  // Periodic realistic blink.
  useEffect(() => {
    const id = setInterval(() => {
      setBlinking(true)
      setTimeout(() => setBlinking(false), 140)
    }, BLINK_INTERVAL_MS + Math.random() * 1200)
    return () => clearInterval(id)
  }, [])

  const eyeScale = blinking ? 0.1 : 1

  if (mode === "float") {
    return (
      <div className="fixed bottom-4 right-4 z-40 pointer-events-none">
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          className="relative w-24 h-36"
        >
          <img src="/creature.png" alt="HiPath creature" className="w-full h-full object-contain drop-shadow-lg" />
          <EyeOverlay scale={eyeScale} expression={expression} />
          <MouthOverlay expression={expression} />
        </motion.div>
      </div>
    )
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 20 }}
          className="fixed bottom-20 right-6 z-50 bg-card border border-border rounded-2xl shadow-xl p-4 max-w-xs"
        >
          <div className="flex items-start gap-3">
            <div className="relative w-12 h-16">
              <img src="/creature.png" alt="HiPath creature" className="w-full h-full object-contain" />
              <EyeOverlay scale={eyeScale} expression={expression} small />
              <MouthOverlay expression={expression} small />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">HiPath Creature</p>
              {message && <p className="text-xs text-muted-foreground mt-1">{message}</p>}
            </div>
            <button className="text-xs text-muted-foreground" onClick={() => { setVisible(false); onClose?.() }}>✕</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function EyeOverlay({ scale, expression, small }: { scale: number; expression: Expression; small?: boolean }) {
  const base = small ? 6 : 10
  const top = small ? "34%" : "36%"
  const leftL = small ? "28%" : "34%"
  const leftR = small ? "58%" : "58%"
  const color = expression === "sad" ? "#6b7280" : "#1f2937"
  return (
    <>
      <div
        className="absolute rounded-full"
        style={{ left: leftL, top, width: base, height: base, background: color, transform: `scaleY(${scale})`, transition: "transform 0.08s" }}
      />
      <div
        className="absolute rounded-full"
        style={{ left: leftR, top, width: base, height: base, background: color, transform: `scaleY(${scale})`, transition: "transform 0.08s" }}
      />
    </>
  )
}

function MouthOverlay({ expression, small }: { expression: Expression; small?: boolean }) {
  const width = small ? 14 : 22
  const left = small ? "38%" : "39%"
  const top = small ? "52%" : "54%"
  const path =
    expression === "happy"
      ? "M2,2 Q11,12 20,2"
      : expression === "sad"
        ? "M2,10 Q11,0 20,10"
        : "M4,6 L18,6"
  return (
    <svg
      className="absolute"
      style={{ left, top, width, height: small ? 8 : 12 }}
      viewBox="0 0 22 12"
    >
      <path d={path} stroke="#1f2937" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}