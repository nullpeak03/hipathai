"use client"
import { useEffect } from "react"
import { usePathname } from "next/navigation"

/**
 * Landing-only entrance animation. Keeping this scoped to the marketing page
 * avoids the old site-wide behaviour where every `section`, `article`, and
 * `.card` started at opacity 0 — which blanked app screens, print output,
 * and full-page captures until an IntersectionObserver happened to fire.
 */
const SELECTOR = "main > section"

export function ScrollReveal() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname !== "/") return
    if (typeof IntersectionObserver === "undefined") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const els = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR))
    if (!els.length) return

    els.forEach((el) => el.classList.add("reveal"))

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in-view")
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" }
    )
    els.forEach((el) => io.observe(el))

    // Reveal anything already on screen without waiting for the first callback.
    const raf = requestAnimationFrame(() => {
      els.forEach((el) => {
        const rect = el.getBoundingClientRect()
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          el.classList.add("in-view")
          io.unobserve(el)
        }
      })
    })

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [pathname])

  return null
}
