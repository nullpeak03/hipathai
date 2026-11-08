"use client"

import { useEffect, useState } from "react"

/**
 * Observes the shared mobile nav toggle without modifying Sidebar.
 * The drawer and its toggle live in Sidebar, but Settings must not paint a
 * sticky picker over the open drawer. The button's accessible name is the
 * stable, user-facing signal for the drawer state.
 */
export function useAppMenuOpen(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const button = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Open menu"], button[aria-label="Close menu"]'
    )
    if (!button) return

    const sync = () => setOpen(button.getAttribute("aria-label") === "Close menu")
    sync()

    const observer = new MutationObserver(sync)
    observer.observe(button, { attributes: true, attributeFilter: ["aria-label"] })
    return () => observer.disconnect()
  }, [])

  return open
}
