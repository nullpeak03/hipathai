"use client"

import { BookOpen, X } from "lucide-react"
import type { Gamification, Progress, ReviewItem, RoadmapData, WeakTopic } from "@/lib/store"
import type { Lesson, Phase } from "@/lib/mockData"
import { cn } from "@/lib/utils"
import { xpForNextLevel } from "@/lib/gamification"

type CurrentLesson = { lesson: Lesson; phase: Phase }

type Props = {
  roadmap: RoadmapData | null
  current: CurrentLesson | null
  progress: Progress
  gam: Gamification
  reviews: ReviewItem[]
  weakTopics: WeakTopic[]
  lowMasteryTopics: string[]
  tab: "lesson" | "review"
  onTabChange: (tab: "lesson" | "review") => void
  onStartReview: () => void
  onOpenLesson: () => void
  onClose?: () => void
}

/** Right-hand lesson/review panel from the Tutor design. */
export function TutorSidePanel({
  roadmap,
  current,
  progress,
  gam,
  reviews,
  weakTopics,
  lowMasteryTopics,
  tab,
  onTabChange,
  onStartReview,
  onOpenLesson,
  onClose,
}: Props) {
  const all = roadmap?.phases.flatMap((phase) => phase.lessons.map((lesson) => ({ lesson, phase }))) ?? []
  const total = all.length || roadmap?.totalLessons || 0
  const globalIndex = current ? all.findIndex((entry) => entry.lesson.id === current.lesson.id) + 1 : 0
  const phaseLessons = current?.phase.lessons ?? []
  const phaseDone = phaseLessons.filter((lesson) => progress[lesson.id]?.completed).length
  const phasePct = phaseLessons.length > 0 ? Math.round((phaseDone / phaseLessons.length) * 100) : 0
  const record = current ? progress[current.lesson.id] : undefined
  const mastery = record?.passed ? "Solid" : record ? "Learning" : "New"
  const doneCount = gam.lessonsDone || all.filter((entry) => progress[entry.lesson.id]?.completed).length
  const remaining = Math.max(0, total - doneCount)
  const nextLevelXp = xpForNextLevel(gam.level)

  const objectivesBlock = current?.lesson.contentJson?.sections.find((section) => section.type === "objectives")
  const objectives = objectivesBlock && objectivesBlock.type === "objectives"
    ? objectivesBlock.items.slice(0, 4)
    : current ? [current.lesson.title] : []

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-card" aria-label="Lesson and review">
      <div className="flex items-center border-b border-border px-3.5 pt-2.5">
        <div className="flex flex-1 gap-0.5" role="tablist" aria-label="Lesson panel">
          <button
            role="tab"
            aria-selected={tab === "lesson"}
            onClick={() => onTabChange("lesson")}
            className={cn(
              "-mb-px border-b-2 px-2.5 py-2 text-sm font-medium transition-colors",
              tab === "lesson" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Lesson
          </button>
          <button
            role="tab"
            aria-selected={tab === "review"}
            onClick={() => onTabChange("review")}
            className={cn(
              "-mb-px flex items-center gap-1 border-b-2 px-2.5 py-2 text-sm font-medium transition-colors",
              tab === "review" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Review
            {reviews.length > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[11px] leading-4 text-primary-foreground">{reviews.length}</span>
            )}
          </button>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close lesson panel" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground xl:hidden">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-[18px]">
        {tab === "lesson" ? (
          <>
            <section className="mb-5">
              {current ? (
                <>
                  <p className="text-xs text-muted-foreground">{current.phase.title}</p>
                  <p className="text-base font-semibold leading-snug">{current.lesson.title}</p>
                  <div className="mb-1 mt-2.5 h-1 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${phasePct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Lesson {globalIndex} of {total} · about {current.lesson.estimatedMinutes ?? 10} min
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Your roadmap</p>
                  <p className="text-base font-semibold leading-snug">Pick a lesson to get started</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {total > 0 ? `${total} lessons waiting in your roadmap.` : "Create a roadmap to unlock lessons."}
                  </p>
                  <button onClick={onOpenLesson} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
                    <BookOpen className="h-4 w-4" /> Open roadmap
                  </button>
                </>
              )}
            </section>

            {current && (
              <section className="mb-5">
                <h5 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Objectives</h5>
                {objectives.length > 0 ? (
                  objectives.map((objective, index) => (
                    <div key={`${objective}-${index}`} className="flex items-center gap-2.5 border-t border-border py-2 first:border-t-0">
                      <span className="min-w-0 flex-1 text-sm">{objective}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          mastery === "Solid" ? "bg-ok-bg text-ok-fg" : mastery === "Learning" ? "bg-warn-bg text-warn-fg" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {mastery}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Objectives appear once the lesson is generated.</p>
                )}
              </section>
            )}

            <section className="mb-5">
              <h5 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Your tutor knows</h5>
              <p className="text-sm leading-relaxed">
                {doneCount} {doneCount === 1 ? "lesson" : "lessons"} done, {remaining} left. Quiz pass rate {Math.round(gam.passRate)}%.
                {weakTopics.length > 0
                  ? ` Weak areas: ${weakTopics.slice(0, 3).map((topic) => topic.topic).join(", ")}.`
                  : " Weak areas are added here after a missed question."}
                {lowMasteryTopics.length > 0 ? ` Low mastery: ${lowMasteryTopics.slice(0, 3).join(", ")}.` : ""}
              </p>
            </section>

            <p className="text-xs text-muted-foreground">Mastery reflects the lesson as a whole, not individual objectives.</p>
          </>
        ) : (
          <>
            <section className="mb-5">
              <h5 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Due for review</h5>
              {reviews.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing to review. Missed questions appear here.</p>
              ) : (
                reviews.map((item) => (
                  <div key={item.lessonId} className="mb-2 flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", item.overdueDays > 0 ? "bg-danger-fg" : "bg-warn-fg")} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{item.topic || item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.overdueDays > 0 ? `${item.overdueDays}d overdue` : "Due today"}</p>
                    </div>
                  </div>
                ))
              )}
            </section>
            <button
              onClick={onStartReview}
              disabled={reviews.length === 0}
              className="h-9 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-40"
            >
              Start review · {reviews.length}
            </button>
            <p className="mt-2.5 text-xs text-muted-foreground">Topics return after 1, 3, and 7 days so they stick.</p>
          </>
        )}
      </div>

      <div className="flex shrink-0 justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <span>Lv.{gam.level} · {gam.xp} / {nextLevelXp} XP</span>
        <span>{gam.streak}-day streak</span>
      </div>
    </aside>
  )
}
