"use client"

import { Check, Gauge, MessagesSquare, Target } from "lucide-react"
import { Card } from "@/components/ui/card"
import { IconBadge } from "@/components/ui/icon-badge"
import { Input } from "@/components/ui/input"
import { usePreferences } from "@/components/settings/preferences-provider"
import {
  DAILY_GOAL_MAX,
  DAILY_GOAL_MIN,
  DIFFICULTY_OPTIONS,
  TUTOR_MODES,
  clampDailyGoal,
  type DifficultyPreference,
  type TutorMode,
} from "@/lib/settings-prefs"
import { LESSON_PASS_THRESHOLD, V2_MASTERY_THRESHOLD } from "@/lib/v2-mastery"
import { cn } from "@/lib/utils"

const GOAL_PRESETS = [15, 30, 45, 60, 90, 120]

export function LearningPreferences() {
  const { draft, updatePreference } = usePreferences()
  if (!draft) return null

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-2.5">
          <IconBadge icon={Target} size="sm" tone="muted" />
          <div>
            <h3 className="text-sm font-semibold">Daily goal</h3>
            <p className="text-xs text-muted-foreground">A realistic target for a focused study day.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="w-full sm:max-w-[170px]">
            <label htmlFor="settings-daily-goal" className="text-xs font-medium text-muted-foreground">
              Minutes per day
            </label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                id="settings-daily-goal"
                type="number"
                min={DAILY_GOAL_MIN}
                max={DAILY_GOAL_MAX}
                step={5}
                inputMode="numeric"
                value={draft.dailyGoalMinutes}
                onChange={(event) => updatePreference("dailyGoalMinutes", Number(event.target.value))}
                onBlur={() => updatePreference("dailyGoalMinutes", clampDailyGoal(draft.dailyGoalMinutes))}
                className="w-24"
              />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <input
              type="range"
              aria-label="Daily goal minutes"
              min={DAILY_GOAL_MIN}
              max={DAILY_GOAL_MAX}
              step={5}
              value={clampDailyGoal(draft.dailyGoalMinutes)}
              onChange={(event) => updatePreference("dailyGoalMinutes", Number(event.target.value))}
              className="w-full accent-[var(--primary)]"
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>{DAILY_GOAL_MIN} min</span>
              <span>{DAILY_GOAL_MAX} min</span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {GOAL_PRESETS.map((minutes) => {
            const selected = draft.dailyGoalMinutes === minutes
            return (
              <button
                key={minutes}
                type="button"
                onClick={() => updatePreference("dailyGoalMinutes", minutes)}
                aria-pressed={selected}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {minutes}m
              </button>
            )
          })}
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          This is your learning target. The weekly goal on your dashboard is tracked separately.
        </p>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-2.5">
          <IconBadge icon={MessagesSquare} size="sm" tone="muted" />
          <div>
            <h3 className="text-sm font-semibold">Tutor mode</h3>
            <p className="text-xs text-muted-foreground">How the tutor responds when you ask for help.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {TUTOR_MODES.map((mode) => {
            const selected = draft.tutorMode === mode.value
            return (
              <button
                key={mode.value}
                type="button"
                aria-pressed={selected}
                onClick={() => updatePreference("tutorMode", mode.value as TutorMode)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                  selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:bg-muted"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  )}
                >
                  {selected ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{mode.label}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{mode.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-2.5">
          <IconBadge icon={Gauge} size="sm" tone="muted" />
          <div>
            <h3 className="text-sm font-semibold">Difficulty preference</h3>
            <p className="text-xs text-muted-foreground">The challenge level used to generate practice.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {DIFFICULTY_OPTIONS.map((option) => {
            const selected = draft.difficultyPreference === option.value
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => updatePreference("difficultyPreference", option.value as DifficultyPreference)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:bg-muted"
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {option.label}
                  {selected ? <Check className="h-3.5 w-3.5 text-primary" aria-hidden /> : null}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{option.description}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-4 rounded-xl border border-border bg-app/50 p-3 text-[11px] text-muted-foreground">
          Pass a lesson quiz at {LESSON_PASS_THRESHOLD}% to continue. {V2_MASTERY_THRESHOLD}% mastery is tracked
          separately and never blocks the next lesson.
        </p>
      </Card>
    </div>
  )
}
