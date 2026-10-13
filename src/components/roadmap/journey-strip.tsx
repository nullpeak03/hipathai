"use client"

export type JourneyPhaseState = "done" | "current" | "todo"

export type JourneyPhase = { id: string; title: string; state: JourneyPhaseState; done: number; total: number }

const STEP = 110
const W_PAD = 60

function point(i: number): { x: number; y: number } {
  return { x: W_PAD + i * STEP, y: i % 2 === 0 ? 92 : 48 }
}

function pathFor(n: number): string {
  const pts = Array.from({ length: n }, (_, i) => point(i))
  return pts
    .map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `L${p.x} ${p.y}`))
    .join(" ")
}

/**
 * Compact journey graph: one node per phase along a winding path.
 * Done = filled check, current = pulsing ring, todo = muted lock.
 * Click scrolls to and opens that phase.
 */
export function JourneyStrip({ phases, onSelect }: {
  phases: JourneyPhase[]
  onSelect: (phaseId: string) => void
}) {
  if (phases.length === 0) return null
  const width = W_PAD * 2 + (phases.length - 1) * STEP
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-4 overflow-x-auto" aria-label="Learning journey">
      <svg
        viewBox={`0 0 ${width} 140`}
        className="min-w-full"
        style={{ minWidth: Math.min(width, 560) }}
        role="img"
        aria-label={`${phases.length} phases journey map`}
      >
        <path d={pathFor(phases.length)} fill="none" strokeWidth={5} strokeLinecap="round" className="stroke-border" strokeDasharray="2 9" />
        {phases.map((p, i) => {
          const { x, y } = point(i)
          return (
            <g
              key={p.id}
              transform={`translate(${x} ${y})`}
              onClick={() => onSelect(p.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p.id) } }}
              tabIndex={0}
              role="button"
              aria-label={`${p.title}: ${p.state}, ${p.done} of ${p.total} done`}
              className="cursor-pointer"
            >
              {p.state === "current" && (
                <circle r="26" fill="none" strokeWidth={2} className="stroke-primary animate-pulse" />
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
              <text y="40" textAnchor="middle" fontSize="11" fontWeight={600} className="fill-foreground">
                {p.title.length > 18 ? `${p.title.slice(0, 17)}…` : p.title}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
