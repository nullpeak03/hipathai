"use client"
import { useRef, useState } from "react"
import styles from "@/app/landing.module.css"
import { LESSON_PASS_THRESHOLD } from "@/lib/v2-mastery"

const STEPS = [
  {
    name: "Teach",
    icon: "M4 5h7a3 3 0 013 3v11a2 2 0 00-2-2H4zM20 5h-6",
    title: "Plain-language explanation",
    desc: "The tutor explains one idea at your level, using your goal as context.",
    code: "",
  },
  {
    name: "Example",
    icon: "M8 8l-4 4 4 4M16 8l4 4-4 4",
    title: "A runnable example",
    desc: "See the idea work before you write any yourself.",
    code: 'def counter():\n    n = 0\n    def add():\n        nonlocal n\n        n += 1\n        return n\n    return add',
  },
  {
    name: "Practice",
    icon: "M5 13l4 4L19 7",
    title: "Practice on your weak spots",
    desc: "Exercises lean toward topics you missed before, not random drills.",
    code: "# Your turn:\n# make counter() start at 10",
  },
  {
    name: "Quiz",
    icon: "M12 17v.01M9.5 9a2.5 2.5 0 115 0c0 1.5-2.5 2-2.5 4",
    title: "A quiz that unlocks the next lesson",
    desc: `Score ${LESSON_PASS_THRESHOLD}% or more to move on. You earn 20 XP per lesson.`,
    code: "Q1. What does add() remember?\n ○ n   ○ counter   ○ nothing",
  },
]

/** Four-step learning loop: tabs switch the stage panel. */
export function LoopTabs() {
  const [active, setActive] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const step = STEPS[active]!

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "ArrowDown" && e.key !== "ArrowUp") return
    e.preventDefault()
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1
    const next = (active + dir + STEPS.length) % STEPS.length
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className={styles.loop}>
      <div className={styles.tabs} role="tablist" aria-label="Learning loop steps" onKeyDown={onKeyDown}>
        {STEPS.map((s, i) => (
          <button
            key={s.name}
            ref={(el) => { tabRefs.current[i] = el }}
            className={`${styles.tab} ${i === active ? styles.tabSelected : ""}`}
            role="tab"
            aria-selected={i === active}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={s.icon} /></svg>
            {s.name}
          </button>
        ))}
      </div>
      <div className={styles.stage} role="tabpanel" aria-live="polite">
        <h3>{step.title}</h3>
        <p>{step.desc}</p>
        {step.code ? <pre className={styles.code}>{step.code}</pre> : null}
      </div>
    </div>
  )
}
