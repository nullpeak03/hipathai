"use client"

import Link from "next/link"
import {
  ArrowRight,
  BookOpen,
  Check,
  ClipboardCheck,
  Flame,
  GraduationCap,
  Sparkles,
  Star,
  Target,
  type LucideIcon,
} from "lucide-react"
import { AnimatedNumber } from "@/components/effects/animated-number"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { IconBadge } from "@/components/ui/icon-badge"
import type { NextLessonAction } from "@/lib/daily-priority"
import type { Gamification, ReviewItem } from "@/lib/store"
import { cn } from "@/lib/utils"

type DashboardHeroProps = {
  greeting: string
  firstName?: string
  nextLesson: NextLessonAction
  gam: Gamification
  doneLessons: number
  totalLessons: number
  reviews: ReviewItem[]
  weakTopic: string | null
  hasRoadmap: boolean
  hydrated: boolean
  loaded: boolean
}

type PlanRowProps = {
  icon: LucideIcon
  title: string
  meta: string
  href: string
  tone: "primary" | "warn" | "info"
  done?: boolean
}

function PlanRow({ icon: Icon, title, meta, href, tone, done = false }: PlanRowProps) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    warn: "bg-warn-bg text-warn-fg",
    info: "bg-info-bg text-info-fg",
  } as const

  return (
    <Link
      href={href}
      className="group -mx-2 flex min-h-[52px] items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          done ? "bg-ok-bg text-ok-fg" : toneClasses[tone]
        )}
      >
        {done ? <Check className="h-4 w-4" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm font-medium", done && "text-muted-foreground line-through decoration-border")}>
          {title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{meta}</span>
      </span>
      <ArrowRight
        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  )
}

function StatPill({
  icon: Icon,
  iconClassName,
  children,
}: {
  icon: LucideIcon
  iconClassName?: string
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-medium text-foreground">
      <Icon className={cn("h-3.5 w-3.5", iconClassName)} aria-hidden />
      {children}
    </span>
  )
}

/** Action-first hero: streak context, the next lesson, and a three-step plan. */
export function DashboardHero({
  greeting,
  firstName,
  nextLesson,
  gam,
  doneLessons,
  totalLessons,
  reviews,
  weakTopic,
  hasRoadmap,
  hydrated,
  loaded,
}: DashboardHeroProps) {
  const firstReview = reviews[0]
  const reviewsCleared = loaded && reviews.length === 0
  const roadmapComplete = hasRoadmap && nextLesson.detail === "All lessons passed"
  const weakHref = weakTopic
    ? `/tutor?q=${encodeURIComponent(`Help me master: ${weakTopic}`)}`
    : "/tutor"
  const reviewHref = firstReview
    ? `/roadmap/${firstReview.roadmapId}/lesson/${firstReview.lessonId}`
    : hasRoadmap
      ? "/roadmap"
      : "/onboarding"
  const reviewMeta = !loaded
    ? "Checking your review queue…"
    : firstReview
      ? `${firstReview.topic || firstReview.title} · ${firstReview.overdueDays > 0 ? `${firstReview.overdueDays}d overdue` : "due today"}`
      : "Nothing due today"

  return (
    <Card className="relative overflow-hidden p-0 card-lift">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1100px 380px at 8% -25%, var(--ambient-1), transparent 70%), radial-gradient(720px 300px at 96% 0%, var(--ambient-2), transparent 72%)",
        }}
      />
      <div className="relative p-4 sm:p-6 lg:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="t-caption">
              {greeting}
              {firstName ? `, ${firstName}` : ""}
            </p>
            <h1 className="t-title mt-1 text-2xl sm:text-3xl">Your next best step</h1>
            <p className="t-caption mt-1 max-w-2xl">
              {!hydrated
                ? "Loading your plan…"
                : !hasRoadmap
                  ? "Create your first roadmap and turn your goal into a week-by-week plan."
                  : gam.streak > 0
                    ? `${gam.streak}-day streak — a focused lesson keeps the momentum going.`
                    : "One focused lesson is enough to keep momentum. Start where you left off."}
            </p>
          </div>
          {hydrated ? (
            <div className="flex flex-wrap gap-2">
              <StatPill icon={Flame} iconClassName="text-orange-600 dark:text-orange-400">
                <AnimatedNumber value={gam.streak} />d streak
              </StatPill>
              <StatPill icon={Star} iconClassName="text-amber-600 dark:text-amber-400">
                Lv.<AnimatedNumber value={gam.level} />
              </StatPill>
              <StatPill icon={BookOpen} iconClassName="text-primary">
                <AnimatedNumber value={doneLessons} />
                {totalLessons > 0 ? `/${totalLessons}` : ""} lessons
              </StatPill>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2" aria-hidden>
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-8 w-20 animate-pulse rounded-full border border-border bg-muted" />
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.45fr_1fr]">
          <section aria-labelledby="next-lesson-heading" className="rounded-2xl border border-border bg-app/70 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <IconBadge icon={BookOpen} size="md" tone="primary" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-info-fg">
                  {hydrated ? nextLesson.detail : "Getting ready"}
                </p>
                <h2 id="next-lesson-heading" className="mt-1 text-lg font-bold leading-snug sm:text-xl">
                  {hydrated ? nextLesson.title : "Loading your next step"}
                </h2>
                <p className="t-caption mt-1">
                  {hydrated ? nextLesson.reason : "Syncing your roadmap and progress."}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {hydrated ? (
                <>
                  <Button asChild size="lg" className="gap-2">
                    <Link href={nextLesson.href}>
                      {roadmapComplete ? "Review roadmap" : hasRoadmap ? "Continue learning" : "Create roadmap"}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                  {hasRoadmap ? (
                    <Button asChild variant="outline" size="lg">
                      <Link href="/roadmap">View roadmap</Link>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" size="lg">
                      <Link href="/tutor">Ask the tutor</Link>
                    </Button>
                  )}
                </>
              ) : (
                <div className="h-12 w-full max-w-xs animate-pulse rounded-lg bg-muted" aria-hidden />
              )}
            </div>
          </section>

          <section aria-labelledby="today-plan-heading" className="rounded-2xl border border-border bg-app/70 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              <div>
                <h2 id="today-plan-heading" className="text-sm font-semibold">
                  Today’s plan
                </h2>
                <p className="text-xs text-muted-foreground">Three small steps</p>
              </div>
            </div>
            {hydrated ? (
              <div className="mt-2">
                <PlanRow
                  icon={BookOpen}
                  title={roadmapComplete ? "Review your roadmap" : hasRoadmap ? nextLesson.title : "Create your roadmap"}
                  meta={nextLesson.detail}
                  href={nextLesson.href}
                  tone="primary"
                />
                <PlanRow
                  icon={ClipboardCheck}
                  title={
                    !loaded
                      ? "Checking reviews"
                      : reviews.length > 0
                        ? `Review ${reviews.length} due ${reviews.length === 1 ? "lesson" : "lessons"}`
                        : "Reviews cleared"
                  }
                  meta={reviewMeta}
                  href={reviewHref}
                  tone="warn"
                  done={reviewsCleared}
                />
                <PlanRow
                  icon={weakTopic ? Target : GraduationCap}
                  title={weakTopic ? `Practice ${weakTopic}` : "Ask the tutor for practice"}
                  meta={
                    weakTopic
                      ? "Weak topic · quick guided practice"
                      : loaded
                        ? "No weak topics flagged — try a quick quiz"
                        : "Checking your mastery…"
                  }
                  href={weakHref}
                  tone="info"
                />
              </div>
            ) : (
              <div className="mt-2 space-y-1" aria-hidden>
                {[0, 1, 2].map((item) => (
                  <div key={item} className="flex min-h-[52px] items-center gap-3 px-2">
                    <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                      <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </Card>
  )
}
