"use client"
import { useEffect } from "react"

export function ScrollReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll("section, article, .card"))
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
      { threshold: 0.1 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  return null
}