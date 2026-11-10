"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export type JourneyPhaseState = "done" | "current" | "todo"

export type JourneyPhase = { id: string; title: string; state: JourneyPhaseState; done: number; total: number }

const STEP = 110
const W_PAD = 60
const MIN_FILL_WIDTH = 600

function point(i: number, step: number): { x: number; y: number } {
  return { x: W_PAD + i * step, y: i % 2 === 0 ? 92 : 48 }
}

function pathFor(n: number, step: number): string {
  const pts = Array.from({ length: n }, (_, i) => point(i, step))
  return pts
    .map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `L${p.x} ${p.y}`))
    .join(" ")
}

/**
 * Compact journey graph: one node per phase along a winding path.
 * Done = filled check, current = pulsing ring, todo = muted lock.
 * Click scrolls to and opens that phase.
 *
 * On tablet/desktop the card spans the column and nodes are spaced to fill
 * it; labels truncate to fit. On phones the graph keeps its natural spacing
 * and scrolls horizontally.
 */
export function JourneyStrip({ phases, onSelect, className }: {
  phases: JourneyPhase[]
  onSelect: (phaseId: string) => void
  className?: string
}) {
  const measureRef = useRef<HTMLDivElement>(null)
  const [contentWidth, setContentWidth] = useState(0)

  useEffect(() => {
    const element = measureRef.current
    if (!element) return
    const update = () => setContentWidth(element.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  if (phases.length === 0) return null

  const naturalWidth = W_PAD * 2 + (phases.length - 1) * STEP
  const fill = contentWidth >= MIN_FILL_WIDTH
  const viewWidth = fill ? contentWidth : Math.min(naturalWidth, 720)
  const step =
    fill && phases.length > 1
      ? Math.max(1, (viewWidth - W_PAD * 2) / (phases.length - 1))
      : STEP
  // Labels alternate above and below the path, so they only share horizontal
  // space with the other label in the same row (2 * step apart).
  const maxChars = fill
    ? Math.min(18, Math.max(6, Math.floor((step * 2 - 10) / 5.6)))
    : 18
  const firstX = phases.length === 1 ? viewWidth / 2 : W_PAD

  return (
    <div
      role="group"
      aria-label="Learning journey"
      className={cn(
        "w-full max-w-full overflow-x-auto rounded-2xl border border-border bg-card p-3 sm:p-4",
        className
      )}
    >
      <div ref={measureRef} className="min-w-0">
        <svg
          viewBox={`0 0 ${viewWidth} 140`}
          width={viewWidth}
          height={140}
          className="mx-auto block select-none"
          role="img"
          aria-label={`${phases.length} phases journey map`}
        >
          <path
            d={phases.length === 1 ? `M${firstX} 92` : pathFor(phases.length, step)}
            fill="none"
            strokeWidth={5}
            strokeLinecap="round"
            className="stroke-border"
            strokeDasharray="2 9"
          />
          {phases.map((p, i) => {
            const { y } = point(i, step)
            const x = phases.length === 1 ? firstX : W_PAD + i * step
            const label =
              p.title.length > maxChars ? `${p.title.slice(0, maxChars - 1)}…` : p.title
            return (
              <g
                key={p.id}
                transform={`translate(${x} ${y})`}
                onClick={() => onSelect(p.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p.id) } }}
                tabIndex={0}
                role="button"
                aria-current={p.state === "current" ? "step" : undefined}
                aria-label={`${p.title}: ${p.state}, ${p.done} of ${p.total} done`}
                className="cursor-pointer focus-visible:outline-none [&:focus-visible>circle:first-of-type]:stroke-primary"
              >
                <title>{`${p.title} — ${p.done} of ${p.total} done`}</title>
                {/* Larger transparent hit area for touch and keyboard focus. */}
                <circle r="27" className="fill-transparent" />
                {p.state === "current" && (
                  <circle r="26" fill="none" strokeWidth={2} className="animate-pulse stroke-primary" />
                )}
                <circle
                  r="20"
                  strokeWidth={3}
                  className={
                    p.state === "done"
                      ? "fill-primary stroke-primary"
                      : p.state === "current"
                        ? "fill-card stroke-primary"
                        : "fill-muted stroke-border"
                  }
                />
                {p.state === "done" ? (
                  <path d="M-7 0l5 5 9-10" fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="stroke-primary-foreground" />
                ) : p.state === "todo" ? (
                  <g strokeWidth={2.4} fill="none" strokeLinecap="round" className="stroke-muted-foreground">
                    <rect x="-6" y="-1" width="12" height="9" rx="2" />
                    <path d="M-3.5 -1v-3a3.5 3.5 0 017 0v3" />
                  </g>
                ) : (
                  <text y="6" textAnchor="middle" fontSize="13" fontWeight={700} className="fill-primary">{i + 1}</text>
                )}
                <text
                  y={i % 2 === 0 ? 40 : -30}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={600}
                  className="fill-foreground"
                >
                  {label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
