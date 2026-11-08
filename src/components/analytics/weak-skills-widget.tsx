import Link from "next/link"
import { ArrowRight, CheckCircle2, GraduationCap } from "lucide-react"
import { WidgetShell } from "@/components/dashboard/widget-shell"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import type { WeakSkill } from "@/lib/analytics-insights"
import { cn } from "@/lib/utils"
import { bandBar } from "./mastery-meta"

type WeakSkillsWidgetProps = {
  weakSkills: WeakSkill[]
  hasMastery: boolean
}

export function WeakSkillsWidget({ weakSkills, hasMastery }: WeakSkillsWidgetProps) {
  const visible = weakSkills.slice(0, 5)

  return (
    <WidgetShell
      icon={GraduationCap}
      title="Weak skills"
      subtitle={visible.length > 0 ? `${weakSkills.length} need attention` : "Practice targets"}
      action={
        visible.length > 0 ? (
          <span className="rounded-full bg-warn-bg px-2.5 py-1 text-[11px] font-semibold text-warn-fg">
            {visible.length}
          </span>
        ) : null
      }
    >
      {visible.length === 0 ? (
        <EmptyState
          compact
          icon={CheckCircle2}
          title="No weak skills detected"
          description={
            hasMastery
              ? "Every practiced topic is at 70% or higher. Keep revisiting them so mastery sticks."
              : "Pass a few quizzes and your weakest topics will show up here with practice links."
          }
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/tutor">Open tutor</Link>
            </Button>
          }
        />
      ) : (
        <div>
          {visible.map((skill) => (
            <Link
              key={skill.topic}
              href={`/tutor?q=${encodeURIComponent(`Help me master: ${skill.topic}`)}`}
              className="group -mx-2 flex min-h-[56px] items-center gap-3 rounded-xl border-t border-border px-2 py-2 first:border-t-0 hover:bg-muted/70"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warn-bg text-warn-fg">
                <GraduationCap className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{skill.topic}</span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {skill.reason}
                  {skill.failCount > 0 ? ` · ${skill.failCount} missed` : ""}
                </span>
                {skill.score !== null ? (
                  <span className="mt-1 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn("block h-full rounded-full", bandBar(skill.score))}
                        style={{ width: `${skill.score}%` }}
                      />
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground">{skill.score}%</span>
                  </span>
                ) : null}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                Practice
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ))}
          <p className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
            Practice links open the tutor with a focused prompt for that topic.
          </p>
        </div>
      )}
    </WidgetShell>
  )
}
