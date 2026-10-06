"use client"
import { useEffect, useState } from "react"

const CACHE_KEY = "hipath_entitlement_pro"

/** Pro status for paywalled features (code runner). Cached locally, refreshed per mount. */
export function usePro(): { pro: boolean; loading: boolean } {
  const [pro, setPro] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    try {
      if (localStorage.getItem(CACHE_KEY) === "1") {
        setPro(true)
        setLoading(false)
      }
    } catch {
      // storage unavailable — fall through to network
    }
    ;(async () => {
      try {
        const res = await fetch("/api/me/entitlement", { cache: "no-store" })
        const data = (await res.json().catch(() => null)) as { pro?: boolean } | null
        if (!cancelled) {
          setPro(data?.pro === true)
          try {
            if (data?.pro === true) localStorage.setItem(CACHE_KEY, "1")
            else localStorage.removeItem(CACHE_KEY)
          } catch {}
        }
      } catch {
        // offline — keep cached value
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { pro, loading }
}
