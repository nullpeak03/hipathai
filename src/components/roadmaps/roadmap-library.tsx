"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"

export type LibraryItem = {
  slug: string
  title: string
  description: string
  level: string
  phases: number
  lessons: number
  /** First few phase titles, used as a unique topic preview per roadmap. */
  phasePreview: string[]
}

function levelTone(level: string): string {
  const normalized = level.toLowerCase()
  if (normalized.includes("advanced")) {
    return "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger-fg)]"
  }
  if (normalized.includes("intermediate")) {
    return "border-[color:var(--warn-border)] bg-[color:var(--warn-bg)] text-[color:var(--warn-fg)]"
  }
  return "border-[color:var(--ok-border)] bg-[color:var(--ok-bg)] text-[color:var(--ok-fg)]"
}

export function RoadmapLibrary({ items }: { items: LibraryItem[] }) {
  const [query, setQuery] = useState("")
  const [level, setLevel] = useState("All")

  const levels = useMemo(
    () => ["All", ...Array.from(new Set(items.map((item) => item.level))).sort()],
    [items]
  )

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return items.filter((item) => {
      if (level !== "All" && item.level !== level) return false
      if (!term) return true
      return (
        item.title.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.phasePreview.some((phase) => phase.toLowerCase().includes(term))
      )
    })
  }, [items, level, query])

  return (
    <div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search roadmaps</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Python, DSA, AI agents…"
            className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary"
          />
        </label>
        <label className="sm:w-48">
          <span className="sr-only">Filter by level</span>
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none transition-colors focus:border-primary"
          >
            {levels.map((option) => (
              <option key={option} value={option}>
                {option === "All" ? "All levels" : option}
              </option>
            ))}
          </select>
        </label>
      </div>

      {items.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          New roadmaps are published here every week.{" "}
          <Link href="/sign-up" className="text-primary underline">Create yours →</Link>
        </p>
      ) : filtered.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm font-medium">No roadmaps match “{query}”.</p>
          <button
            type="button"
            onClick={() => { setQuery(""); setLevel("All") }}
            className="mt-2 text-sm text-primary underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {filtered.map((item) => (
            <Link
              key={item.slug}
              href={`/roadmaps/${item.slug}`}
              className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40 hover:shadow-lg"
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${levelTone(item.level)}`}>
                  {item.level}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.phases} phases · {item.lessons} lessons
                </span>
              </div>
              <h2 className="mt-3 text-lg font-semibold leading-snug">{item.title}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {item.phasePreview.map((phase, index) => (
                  <span key={`${phase}-${index}`} className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                    {phase}
                  </span>
                ))}
                {item.phases > item.phasePreview.length && (
                  <span className="rounded-md px-2 py-1 text-[11px] text-muted-foreground">
                    +{item.phases - item.phasePreview.length} more
                  </span>
                )}
              </div>
              <span className="mt-4 text-sm font-medium text-primary">View syllabus →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
