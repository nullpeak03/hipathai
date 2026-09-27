"use client"
import { motion, MotionConfig } from "framer-motion"

/**
 * Shared page-enter transition (subtle by design): quick fade + 8px rise.
 * Respects prefers-reduced-motion via MotionConfig; the global CSS kill
 * switch in globals.css covers the rest.
 */
export function PageTransition({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={className}
      >
        {children}
      </motion.div>
    </MotionConfig>
  )
}
