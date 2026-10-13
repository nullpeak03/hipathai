"use client"
import { useEffect, useRef, useState } from "react"
import styles from "@/app/landing.module.css"

type NodeState = "done" | "open" | "lock"
type TrailNode = { name: string; x: number; y: number; title: string; desc: string; options: string[]; correct: number; state: NodeState }

const INITIAL: TrailNode[] = [
  { name: "Basics", x: 40, y: 190, title: "Variables and types", desc: 'Quiz: what does type("5") return?', options: ["int", "str", "float"], correct: 1, state: "done" },
  { name: "Loops", x: 190, y: 70, title: "For and while loops", desc: "Quiz: how many times does range(3) run?", options: ["2", "3", "4"], correct: 1, state: "done" },
  { name: "Functions", x: 282, y: 148, title: "Functions and scope", desc: "Quiz: what does a function return without return?", options: ["0", "None", "Error"], correct: 1, state: "open" },
  { name: "Classes", x: 372, y: 140, title: "Classes", desc: "Locked. Pass Functions to unlock.", options: [], correct: 0, state: "lock" },
  { name: "Project", x: 450, y: 60, title: "Capstone project", desc: "Locked. Finish Classes first.", options: [], correct: 0, state: "lock" },
]

const PATH_D = "M40 190 C110 190 110 70 190 70 S290 190 350 150 S430 60 450 60"

const ICONS: Record<NodeState, string> = {
  done: "M-7 0l5 5 9-10",
  open: "M-3 -6l9 6-9 6z",
  lock: "M-5 -1h10v8h-10zM-3 -1v-4a3 3 0 016 0v4",
}

/** Interactive roadmap trail: the playable core-loop demo. */
export function TrailMap() {
  const [nodes, setNodes] = useState<TrailNode[]>(INITIAL)
  const [sel, setSel] = useState(2)
  const [picked, setPicked] = useState<number | null>(null)
  const [passedBody, setPassedBody] = useState<string | null>(null)
  const [xpKey, setXpKey] = useState(0)
  const pathRef = useRef<SVGPathElement>(null)
  const [drawn, setDrawn] = useState(false)
  const [pathLen, setPathLen] = useState(640)

  // Measure the real path so the draw animation always completes.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    try {
      if (pathRef.current) setPathLen(pathRef.current.getTotalLength())
    } catch { /* keep fallback */ }
    if (reduce) {
      setDrawn(true)
      return
    }
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)))
    return () => cancelAnimationFrame(raf)
  }, [])

  const done = nodes.filter((l) => l.state === "done").length
  const pct = Math.round((done / nodes.length) * 100)
  const node = nodes[sel]!

  const answer = (oi: number) => {
    if (node.state !== "open" || picked !== null) return
    setPicked(oi)
    if (oi === node.correct) {
      const wasLockedNext = nodes[sel + 1]?.state === "lock"
      const nextName = nodes[sel + 1]?.name ?? null
      setNodes((prev) => {
        const next = prev.map((l) => ({ ...l }))
        next[sel]!.state = "done"
        const nx = next[sel + 1]
        if (nx && nx.state === "lock") {
          nx.state = "open"
          nx.desc = "Unlocked. Take the quiz when ready."
        }
        return next
      })
      setXpKey((k) => k + 1)
      setPassedBody(wasLockedNext && nextName ? `${nextName} is now open.` : "Roadmap finished.")
    } else {
      setTimeout(() => setPicked((p) => (p === oi ? null : p)), 400)
    }
  }

  const select = (i: number) => {
    setSel(i)
    setPicked(null)
    setPassedBody(null)
  }

  return (
    <div className={styles.trail}>
      <div className={styles.trailHead}>
        <h3 className={styles.trailTitle}>Python in 8 weeks</h3>
        <span className={styles.pill}>{pct}% done</span>
      </div>
      <span key={xpKey} className={`${styles.xp} ${xpKey > 0 ? styles.xpGo : ""}`}>+20 XP</span>
      <svg className={styles.map} viewBox="0 0 480 250" role="img" aria-label="Interactive roadmap with five lessons">
        <path className={styles.pathBg} d={PATH_D} />
        <path
          ref={pathRef}
          className={styles.pathFg}
          d={PATH_D}
          style={{ strokeDasharray: pathLen, strokeDashoffset: drawn ? 0 : pathLen }}
        />
        <g>
          {nodes.map((l, i) => (
            <g
              key={l.name}
              className={`${styles.node} ${l.state === "done" ? styles.nodeDone : l.state === "open" ? styles.nodeOpen : styles.nodeLock}`}
              tabIndex={0}
              role="button"
              aria-label={`${l.name}, ${l.state}`}
              transform={`translate(${l.x} ${l.y})`}
              onClick={() => select(i)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(i) } }}
            >
              <circle r="20" />
              <path className={styles.nodeIc} d={ICONS[l.state]} />
              <text y="42" textAnchor="middle">{l.name}</text>
            </g>
          ))}
        </g>
      </svg>
      <div className={styles.panel} aria-live="polite">
        {passedBody ? (
          <>
            <b>Passed. {node.name} complete.</b>
            <p>{passedBody}</p>
          </>
        ) : (
          <>
            <b>{node.title}</b>
            <p>{node.desc}</p>
            {node.state === "open" && (
              <div className={styles.quiz}>
                {node.options.map((a, oi) => (
                  <button
                    key={a}
                    disabled={picked !== null}
                    onClick={() => answer(oi)}
                    className={picked === null ? undefined : picked === oi ? (oi === node.correct ? styles.right : styles.wrong) : undefined}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
