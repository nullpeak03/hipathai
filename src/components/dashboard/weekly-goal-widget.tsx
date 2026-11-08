"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Pencil, Target } from "lucide-react"
import { AnimatedNumber } from "@/components/effects/animated-number"
import { Button } from "@/components/ui/button"
import {
  DEFAULT_WEEKLY_GOAL,
  loadWeeklyGoal,
  saveWeeklyGoal,
} from "@/lib/dashboard"
import { WidgetShell } from "./widget-shell"

type WeeklyGoalWidgetProps = {
  weekMinutes: number
  loaded: boolean
}

export function WeeklyGoalWidget({ weekMinutes, loaded }: WeeklyGoalWidgetProps) {
  const [goal, setGoal] = useState(DEFAULT_WEEKLY_GOAL)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(DEFAULT_WEEKLY_GOAL))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const stored = loadWeeklyGoal()
    setGoal(stored)
    setDraft(String(stored))
  }, [])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const progress = Math.min(100, Math.round((weekMinutes / goal) * 100))
  const remaining = Math.max(0, goal - weekMinutes)

  const startEditing = () => {
    setDraft(String(goal))
    setEditing(true)
  }

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next = saveWeeklyGoal(draft)
    setGoal(next)
    setDraft(String(next))
    setEditing(false)
  }

  return (
    <WidgetShell icon={Target} title="Weekly goal" subtitle="Minutes this week">
      {!loaded ? (
        <div className="space-y-4" aria-hidden>
          <div className="h-9 w-32 animate-pulse rounded bg-muted" />
          <div className="h-2.5 animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-40 animate-pulse rounded bg-muted" />
        </div>
      ) : editing ? (
        <form onSubmit={handleSave} className="space-y-3">
          <label htmlFor="weekly-goal" className="block text-xs font-medium text-muted-foreground">
            Weekly goal in minutes
          </label>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              id="weekly-goal"
              type="number"
              min={15}
              max={10080}
              step={1}
              inputMode="numeric"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="h-10 w-24 rounded-lg border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <span className="text-xs text-muted-foreground">min / week</span>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="gap-1.5">
              <Check className="h-4 w-4" aria-hidden /> Save
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <span className="text-3xl font-bold tracking-tight">
                <AnimatedNumber value={weekMinutes} />
              </span>
              <span className="text-sm text-muted-foreground"> / {goal} min</span>
            </div>
            <button
              type="button"
              onClick={startEditing}
              aria-label="Edit weekly goal"
              className="-m-1.5 inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Weekly study goal progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary-hover transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {progress >= 100 ? (
              <span className="font-medium text-ok-fg">Goal reached — nice work this week.</span>
            ) : (
              <>
                <span className="font-medium text-foreground">{remaining} min</span> to go this week.
              </>
            )}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Goal resets every Monday.</p>
        </div>
      )}
    </WidgetShell>
  )
}
