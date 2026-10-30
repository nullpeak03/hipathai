"use client"
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

type CreatureProps = {
  mode?: "float" | "burst"
  message?: string
  open?: boolean
  onClose?: () => void
}

export function Creature({ mode = "float", message, open = true, onClose }: CreatureProps) {
  const [visible, setVisible] = useState(open)
  useEffect(() => setVisible(open), [open])

  if (mode === "float") {
    return (
      <div className="fixed bottom-4 right-4 z-40 pointer-events-none">
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-2xl shadow-lg"
          aria-label="HiPath creature"
        >
          🐾
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
            <div className="text-3xl">🐾</div>
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