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
  const [follow, setFollow] = useState(true)
  const [pos, setPos] = useState({ x: 120, y: 120 })
  const [rot, setRot] = useState(0)
  const [flip, setFlip] = useState(1)

  useEffect(() => setVisible(open), [open])

  // Blink periodically.
  useEffect(() => {
    const id = setInterval(() => {
      setBlinking(true)
      setTimeout(() => setBlinking(false), 120)
    }, 2800 + Math.random() * 1500)
    return () => clearInterval(id)
  }, [])

  // Follow cursor.
  useEffect(() => {
    if (mode !== "float" || !follow) return
    const onMove = (e: MouseEvent) => {
      const nx = Math.min(Math.max(e.clientX - 30, 40), window.innerWidth - 80)
      const ny = Math.min(Math.max(e.clientY - 30, 40), window.innerHeight - 80)
      setPos({ x: nx, y: ny })
      const dx = e.clientX - (pos.x + 30)
      setRot(Math.max(-20, Math.min(20, dx * 0.15)))
      setFlip(dx >= 0 ? 1 : -1)
    }
    window.addEventListener("mousemove", onMove)
    return () => window.removeEventListener("mousemove", onMove)
  }, [mode, follow, pos.x])

  const mouthPath =
    expression === "happy" ? "M10,18 Q20,28 30,18" : expression === "sad" ? "M10,26 Q20,16 30,26" : "M12,22 L28,22"

  const blob = (
    <svg width="60" height="60" viewBox="0 0 40 40">
      <motion.circle cx="20" cy="20" r="18" fill="url(#g)" animate={{ r: [18, 19, 18] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }} />
      <defs>
        <radialGradient id="g" cx="50%" cy="40%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#6C5BFF" />
        </radialGradient>
      </defs>
      <ellipse cx="14" cy="16" rx="3" ry={blinking ? 0.4 : 3} fill="#1f2937" />
      <ellipse cx="26" cy="16" rx="3" ry={blinking ? 0.4 : 3} fill="#1f2937" />
      <path d={mouthPath} stroke="#1f2937" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )

  if (mode === "float") {
    return (
      <>
        <motion.div
          className="fixed z-40 pointer-events-none"
          animate={{ x: pos.x, y: pos.y, rotate: rot, scaleX: flip }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
        >
          {blob}
        </motion.div>
        <button
          onClick={() => setFollow((f) => !f)}
          className="fixed bottom-4 left-4 z-50 text-xs px-3 py-1.5 rounded-full bg-card border border-border shadow"
        >
          {follow ? "Stop following" : "Start following"}
        </button>
      </>
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