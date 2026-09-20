"use client"
import { useEffect, useRef, useState } from "react"

// Aura cursor: minimal dot + spring-trailing ring, site-wide.
// Transform-only updates (GPU-cheap), non-interactive, and fully disabled on
// touch devices, over text inputs, and under prefers-reduced-motion.

const RING = 36

export function AuraCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const [enabled, setEnabled] = useState(false)
  const [isMatrix, setIsMatrix] = useState(false)
  const [hot, setHot] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [shown, setShown] = useState(false)
  const [clicking, setClicking] = useState(false)

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    setEnabled(true)

    const root = document.documentElement
    const syncTheme = () => setIsMatrix(root.classList.contains("matrix"))
    syncTheme()
    const obs = new MutationObserver(syncTheme)
    obs.observe(root, { attributes: true, attributeFilter: ["class"] })

    let x = -100
    let y = -100
    let rx = -100
    let ry = -100
    let raf = 0
    let lastHot = false
    let lastHidden = false

    const onMove = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
      setShown(true)
      const t = e.target as HTMLElement | null
      const nextHot = !!t?.closest?.(
        "a,button,[role='button'],[role='switch'],summary,input[type='checkbox'],input[type='radio'],[data-aura-hot]"
      )
      if (nextHot !== lastHot) {
        lastHot = nextHot
        setHot(nextHot)
      }
      const nextHidden = !!t?.closest?.("input,textarea,select,[contenteditable]")
      if (nextHidden !== lastHidden) {
        lastHidden = nextHidden
        setHidden(nextHidden)
      }
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
      }
    }
    const onDown = () => setClicking(true)
    const onUp = () => setClicking(false)
    const onLeave = () => setShown(false)
    const onEnter = () => setShown(true)

    const loop = () => {
      rx += (x - rx) * 0.16
      ry += (y - ry) * 0.16
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    document.addEventListener("pointermove", onMove, { passive: true })
    document.addEventListener("mousedown", onDown)
    document.addEventListener("mouseup", onUp)
    document.documentElement.addEventListener("mouseleave", onLeave)
    document.documentElement.addEventListener("mouseenter", onEnter)
    return () => {
      cancelAnimationFrame(raf)
      obs.disconnect()
      document.removeEventListener("pointermove", onMove)
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("mouseup", onUp)
      document.documentElement.removeEventListener("mouseleave", onLeave)
      document.documentElement.removeEventListener("mouseenter", onEnter)
    }
  }, [])

  if (!enabled) return null
  const color = isMatrix ? "#00E676" : "#6C5BFF"
  const visible = shown && !hidden
  const scale = clicking ? 0.7 : hot ? 1.7 : 1

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden="true"
        className="fixed left-0 top-0 z-[100] pointer-events-none transition-opacity duration-150"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <div
          className="rounded-full -translate-x-1/2 -translate-y-1/2"
          style={{ width: 6, height: 6, background: color }}
        />
      </div>
      <div
        ref={ringRef}
        aria-hidden="true"
        className="fixed left-0 top-0 z-[100] pointer-events-none transition-opacity duration-150"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <div
          className="rounded-full -translate-x-1/2 -translate-y-1/2"
          style={{
            width: RING,
            height: RING,
            transform: `translate(-50%, -50%) scale(${scale})`,
            border: `1.5px solid ${color}`,
            boxShadow: `0 0 14px ${color}55`,
            transition: "transform 0.18s ease-out, border-color 0.3s, box-shadow 0.3s",
          }}
        />
      </div>
    </>
  )
}
