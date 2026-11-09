"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { ChevronDown, GraduationCap, Sparkles } from "lucide-react"
import { Card } from "@/components/ui/card"
import { IconBadge } from "@/components/ui/icon-badge"
import { V2_MASTERY_THRESHOLD } from "@/lib/v2-mastery"
import { cn } from "@/lib/utils"

const SkillReadinessPanel = dynamic(
  () => import("@/components/readiness/skill-readiness-panel").then((module) => module.SkillReadinessPanel),
  {
    ssr: false,
    loading: () => <p className="mt-4 text-sm text-muted-foreground">Loading readiness evidence…</p>,
  }
)

export type SkillNodeSummary = { topic: string; mastery?: number }

type SkillsReadinessSectionProps = {
  roadmapId: string
  skillNodes: SkillNodeSummary[]
  refreshKey: string
  /** Increment to open and reveal the section from another control. */
  openSignal?: number
}

function masteryTone(mastery: number): string {
  if (mastery >= V2_MASTERY_THRESHOLD) return "bg-ok-fg"
  if (mastery >= 60) return "bg-primary"
  return "bg-warn-fg"
}

export function SkillsReadinessSection({ roadmapId, skillNodes, refreshKey, openSignal = 0 }: SkillsReadinessSectionProps) {
  const [open, setOpen] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)

  useEffect(() => {
    if (openSignal > 0) {
      setOpen(true)
      setHasOpened(true)
    }
  }, [openSignal])

  const measured = skillNodes.filter(
    (node): node is SkillNodeSummary & { mastery: number } => typeof node.mastery === "number"
  )
  const average = measured.length
    ? Math.round(measured.reduce((total, node) => total + node.mastery, 0) / measured.length)
    : null

  const toggle = () => {
    setOpen((current) => !current)
    setHasOpened(true)
  }

  return (
    <Card id="skills-readiness" className="scroll-mt-20 overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="skills-readiness-body"
        className="flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40 sm:p-5"
      >
        <div className="flex min-w-0 items-start gap-3">
          <IconBadge icon={GraduationCap} size="md" tone="primary" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold">Skills &amp; readiness</span>
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Evidence, not a gate
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {skillNodes.length} skill{skillNodes.length === 1 ? "" : "s"} tracked
              {average !== null ? ` · ${average}% average mastery` : " · mastery builds as you pass quizzes"}
            </p>
          </div>
        </div>
        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
          {open ? "Hide" : "Show"}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </button>

      {hasOpened ? (
        <div
          id="skills-readiness-body"
          className={cn("space-y-6 border-t border-border p-4 sm:p-5", !open && "hidden")}
        >
          <section aria-labelledby="skill-mastery-heading">
            <div className="flex items-baseline justify-between gap-2">
              <h3 id="skill-mastery-heading" className="text-sm font-semibold">
                Mastery by skill
              </h3>
              <span className="text-[11px] text-muted-foreground">
                Target {V2_MASTERY_THRESHOLD}%
              </span>
            </div>
            {skillNodes.length > 0 ? (
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {skillNodes.map((node) => {
                  const mastery = node.mastery ?? 0
                  return (
                    <div key={node.topic} className="rounded-xl border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-medium" title={node.topic}>
                          {node.topic}
                        </p>
                        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                          {mastery}%
                        </span>
                      </div>
                      <div
                        className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-label={`${node.topic} mastery`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={mastery}
                      >
                        <div
                          className={cn("h-full rounded-full transition-all", masteryTone(mastery))}
                          style={{ width: `${mastery}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Skill mastery will appear after your roadmap and quiz history load.
              </p>
            )}
          </section>

          <section aria-labelledby="skill-readiness-heading" className="border-t border-border pt-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              <h3 id="skill-readiness-heading" className="text-sm font-semibold">
                Readiness evidence
              </h3>
            </div>
            <SkillReadinessPanel
              roadmapId={roadmapId}
              embedded
              enabled={open}
              refreshKey={refreshKey}
            />
          </section>
        </div>
      ) : null}
    </Card>
  )
}
