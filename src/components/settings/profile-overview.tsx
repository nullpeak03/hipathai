"use client"

import Image from "next/image"
import Link from "next/link"
import { Award, BarChart3, BookOpenCheck, Clock3, Flame, GraduationCap, Sparkles, Star, Target } from "lucide-react"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { IconBadge } from "@/components/ui/icon-badge"
import type { Gamification } from "@/lib/store"

type ProfileOverviewProps = {
  gam: Gamification
  loaded: boolean
  onEditProfile: () => void
}

function formatMinutes(total: number): string {
  if (!Number.isFinite(total) || total <= 0) return "0m"
  const hours = Math.floor(total / 60)
  const minutes = Math.round(total % 60)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: typeof Award
  label: string
  value: string
  tone: "primary" | "info" | "warn" | "ok"
}) {
  return (
    <div className="rounded-xl border border-border bg-app/60 p-3">
      <div className="flex items-center gap-2">
        <IconBadge icon={icon} size="sm" tone={tone} />
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

export function ProfileOverview({ gam, loaded, onEditProfile }: ProfileOverviewProps) {
  const { user } = useUser()
  const number = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback)
  const level = number(gam.level, 1)
  const xp = number(gam.xp)
  const streak = number(gam.streak)
  const bestStreak = number(gam.bestStreak)
  const lessonsDone = number(gam.lessonsDone)
  const studyMinutes = number(gam.studyMinutes)
  const passRate = number(gam.passRate)

  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden p-0 card-lift">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 320px at 6% -30%, var(--ambient-1), transparent 70%), radial-gradient(700px 280px at 96% 0%, var(--ambient-2), transparent 72%)",
          }}
        />
        <div className="relative p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              {user?.imageUrl ? (
                <Image
                  src={user.imageUrl}
                  alt={user.fullName ? `${user.fullName} avatar` : "Profile avatar"}
                  width={72}
                  height={72}
                  className="h-16 w-16 shrink-0 rounded-2xl border border-border object-cover sm:h-[72px] sm:w-[72px]"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground sm:h-[72px] sm:w-[72px]">
                  {(user?.firstName?.[0] ?? user?.fullName?.[0] ?? "H").toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold sm:text-xl">
                  {user?.fullName || user?.firstName || "HiPath learner"}
                </h3>
                <p className="truncate text-sm text-muted-foreground">
                  {user?.primaryEmailAddress?.emailAddress ?? "No email on file"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {user?.createdAt
                    ? `Member since ${user.createdAt.toLocaleDateString(undefined, { month: "long", year: "numeric" })}`
                    : "Your learning account"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={onEditProfile} className="gap-1.5">
                <GraduationCap className="h-4 w-4" aria-hidden />
                Edit profile
              </Button>
              <Button size="sm" variant="ghost" asChild className="gap-1.5">
                <Link href="/analytics">
                  <BarChart3 className="h-4 w-4" aria-hidden />
                  View analytics
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {loaded ? (
              <>
                <StatTile icon={Sparkles} label="Level" value={String(level)} tone="primary" />
                <StatTile icon={Star} label="XP" value={xp.toLocaleString()} tone="info" />
                <StatTile icon={Flame} label="Streak" value={`${streak}d`} tone="warn" />
                <StatTile icon={Award} label="Best streak" value={`${bestStreak}d`} tone="ok" />
              </>
            ) : (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-[92px] animate-pulse rounded-xl border border-border bg-muted/60" />
              ))
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <IconBadge icon={Target} size="sm" tone="muted" />
            <div>
              <h3 className="text-sm font-semibold">Learning snapshot</h3>
              <p className="text-xs text-muted-foreground">Everything you have built so far.</p>
            </div>
          </div>
          <dl className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <BookOpenCheck className="h-4 w-4" aria-hidden />
                Lessons completed
              </dt>
              <dd className="font-semibold tabular-nums">{loaded ? lessonsDone : "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Clock3 className="h-4 w-4" aria-hidden />
                Study time
              </dt>
              <dd className="font-semibold tabular-nums">{loaded ? formatMinutes(studyMinutes) : "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Target className="h-4 w-4" aria-hidden />
                Quiz pass rate
              </dt>
              <dd className="font-semibold tabular-nums">{loaded ? `${Math.round(passRate)}%` : "—"}</dd>
            </div>
          </dl>
        </Card>

        <Card className="flex flex-col justify-between gap-4 p-4 sm:p-5">
          <div>
            <div className="flex items-center gap-2.5">
              <IconBadge icon={Sparkles} size="sm" tone="primary" />
              <div>
                <h3 className="text-sm font-semibold">HiPath Pro is coming</h3>
                <p className="text-xs text-muted-foreground">Core learning stays free.</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Planned Pro features are still in the works. Your roadmaps, tutor, analytics, and offline
              access stay available on the free plan.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="w-fit">
            <Link href="/pricing">View pricing</Link>
          </Button>
        </Card>
      </div>
    </div>
  )
}
