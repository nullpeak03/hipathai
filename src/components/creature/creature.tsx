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

export function Creature({ mode = "float", message, open = true, onClose, expression = "neutral" }: CreatureProps) {
  const [visible, setVisible] = useState(open)
  const [blinking, setBlinking] = useState(false)
  const [pos, setPos] = useState({ x: 100, y: 100 })

  useEffect(() => setVisible(open), [open])

  // Blink periodically.
  useEffect(() => {
    const id = setInterval(() => {
      setBlinking(true)
      setTimeout(() => setBlinking(false), 120)
    }, 2800 + Math.random() * 1500)
    return () => clearInterval(id)
  }, [])

  // Wander across the screen with "own intelligence".
  useEffect(() => {
    if (mode !== "float") return
    const move = () => {
      const x = 60 + Math.random() * (window.innerWidth - 160)
      const y = 60 + Math.random() * (window.innerHeight - 160)
      setPos({ x, y })
    }
    move()
    const id = setInterval(move, 4000 + Math.random() * 2000)
    return () => clearInterval(id)
  }, [mode])

  const mouthPath =
    expression === "happy" ? "M10,18 Q20,28 30,18" : expression === "sad" ? "M10,26 Q20,16 30,26" : "M12,22 L28,22"

  const blob = (
    <svg width="60" height="60" viewBox="0 0 40 40">
      <motion.circle
        cx="20" cy="20" r="18"
        fill="url(#g)"
        animate={{ r: [18, 19, 18] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <defs>
        <radialGradient id="g" cx="50%" cy="40%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#6C5BFF" />
        </radialGradient>
      </defs>
      {/* eyes */}
      <ellipse cx="14" cy="16" rx="3" ry={blinking ? 0.4 : 3} fill="#1f2937" />
      <ellipse cx="26" cy="16" rx="3" ry={blinking ? 0.4 : 3} fill="#1f2937" />
      {/* mouth */}
      <path d={mouthPath} stroke="#1f2937" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )

  if (mode === "float") {
    return (
      <motion.div
        className="fixed z-40 pointer-events-none"
        animate={{ x: pos.x, y: pos.y }}
        transition={{ duration: 2.2, ease: "easeInOut" }}
      >
        {blob}
      </motion.div>
    )
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          className="fixed bottom-20 right-6 z-50 bg-card border border-border rounded-2xl shadow-xl p-4 max-w-xs"
        >
          <div className="flex items-start gap-3">
            <div className="w-12 h-12">{blob}</div>
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