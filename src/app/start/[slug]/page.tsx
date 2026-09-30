"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"

/**
 * Template entry: /start/[slug] clones the public syllabus into the
 * caller's account, then lands on the roadmap. Unauthenticated visitors
 * bounce through Clerk sign-in first (middleware sets redirect_url), so
 * template intent survives auth with no custom session logic.
 */
export default function StartRoadmap() {
  const { slug } = useParams() as { slug: string }
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/roadmaps/clone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        })
        const data = (await res.json().catch(() => ({}))) as { roadmapId?: string; error?: string }
        if (cancelled) return
        if (!res.ok || !data.roadmapId) {
          setError(data.error || "Could not start this roadmap. Please try again.")
          return
        }
        router.replace("/roadmap")
      } catch {
        if (!cancelled) setError("Could not start this roadmap. Please try again.")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, router])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">H</div>
      {error ? (
        <>
          <h1 className="text-xl font-bold mt-6">Couldn&apos;t start this roadmap</h1>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
          <Link href="/roadmaps" className="text-sm text-primary underline mt-4">Back to library →</Link>
        </>
      ) : (
        <>
          <h1 className="text-xl font-bold mt-6">Setting up your roadmap…</h1>
          <p className="text-sm text-muted-foreground mt-2">Copying lessons into your account. Takes a few seconds.</p>
          <div className="mt-6 h-2 w-48 bg-muted rounded-full overflow-hidden"><div className="h-2 bg-primary rounded-full shimmer w-1/2" /></div>
        </>
      )}
    </div>
  )
}
