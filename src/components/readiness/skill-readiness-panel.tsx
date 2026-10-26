"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type Evidence = {
  id: string
  type: string
  label: string
  occurredAt: string
  score: number | null
  verified: boolean
  detail?: string
  href: string
}

type Skill = {
  topic: string
  lessonId: string | null
  lessonTitle: string
  status: string
  statusLabel: string
  score: number | null
  explanation: string
  nextStep: string
  evidence: Evidence[]
}

type ReadinessReport = {
  roadmap: { id: string; title: string }
  roadmapCompleted: boolean
  completedLessons: number
  totalLessons: number
  completionRequirements: { lessonsPassed: boolean; phaseExamsPassed: boolean }
  passRate: number
  averageMastery: number
  skills: Skill[]
  snapshot: { data: { skills?: Skill[] }; completedAt: string | null } | null
}

const statusStyles: Record<string, string> = {
  "Not assessed": "bg-muted text-muted-foreground",
  Learning: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  Practicing: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Demonstrated: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "Needs review": "bg-rose-500/10 text-rose-700 dark:text-rose-300",
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString()
}

export function SkillReadinessPanel({ roadmapId, compact = false, refreshKey }: { roadmapId: string; compact?: boolean; refreshKey?: string | number }) {
  const [report, setReport] = useState<ReadinessReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [retryCount, setRetryCount] = useState(0)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/me/skill-readiness?roadmapId=${encodeURIComponent(roadmapId)}`, { cache: "no-store" })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error || "Could not load skill readiness.")
        let nextReport = body.report as ReadinessReport
        if (nextReport.roadmapCompleted && !nextReport.snapshot) {
          const finalResponse = await fetch("/api/me/skill-readiness", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roadmapId }),
          })
          const finalBody = await finalResponse.json().catch(() => ({}))
          if (!finalResponse.ok) throw new Error(finalBody.error || "Could not save the final readiness report.")
          nextReport = finalBody.report as ReadinessReport
        }
        if (active) setReport(nextReport)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load skill readiness.")
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [roadmapId, retryCount, refreshKey])

  const skills = compact ? (report?.skills ?? []).slice(0, 5) : report?.skills ?? []

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Skill readiness</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Evidence-based guidance, not a progression gate. Quiz-derived mastery and pass rates are context, not separate evidence.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {compact && <Link href="/roadmap" className="text-xs text-primary underline">View roadmap</Link>}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={!hidden}
            onClick={() => setHidden((current) => !current)}
          >
            {hidden ? "Show" : "Hide"}
          </Button>
        </div>
      </div>

      {!hidden && <>
      {loading && <p className="mt-4 text-sm text-muted-foreground" role="status">Loading readiness evidence…</p>}
      {!loading && error && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setRetryCount((count) => count + 1)}>Retry</Button>
        </div>
      )}
      {!loading && !error && report && (
        <>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{report.completedLessons}/{report.totalLessons} lessons passed</span>
            <span>{report.passRate}% overall pass rate</span>
            <span>{report.averageMastery}% average mastery</span>
          </div>
          {report.snapshot && (
            <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="text-sm font-medium">Final readiness snapshot saved</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Frozen {report.snapshot.completedAt ? formatDate(report.snapshot.completedAt) : "at roadmap completion"}; this current view may continue to change with new evidence.
              </p>
              {!compact && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(report.snapshot.data.skills ?? []).slice(0, 6).map((skill) => (
                    <span key={`${skill.lessonId}:${skill.topic}`} className={`rounded-full px-2 py-1 text-[11px] ${statusStyles[skill.statusLabel] ?? "bg-muted text-muted-foreground"}`}>
                      {skill.topic}: {skill.statusLabel}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {!report.snapshot && (
            <p className="mt-3 text-xs text-muted-foreground">
              Final snapshot is saved after all lessons and phase mastery quizzes are passed.
            </p>
          )}
          <div className={`mt-4 space-y-3 ${compact ? "max-h-96 overflow-y-auto pr-1" : ""}`}>
            {skills.map((skill) => (
              <article key={`${skill.lessonId}:${skill.topic}`} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-sm">{skill.topic}</div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusStyles[skill.statusLabel] ?? "bg-muted text-muted-foreground"}`}>
                    {skill.statusLabel}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{skill.explanation}</p>
                {skill.score !== null && <p className="mt-1 text-xs">Recent-weighted quiz score: <strong>{skill.score}%</strong></p>}
                <p className="mt-2 text-xs"><strong>Next step:</strong> {skill.nextStep}</p>
                {skill.evidence.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-primary">Evidence ({skill.evidence.length})</summary>
                    <ul className="mt-2 space-y-2">
                      {skill.evidence.map((item) => (
                        <li key={item.id} className="border-l-2 border-border pl-2 text-xs">
                          <Link href={item.href} className="font-medium text-primary underline">{item.label}</Link>
                          <span className="text-muted-foreground"> · {formatDate(item.occurredAt)}</span>
                          {!item.verified && <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-muted-foreground">Learner-reported</span>}
                          {item.detail && <p className="mt-1 text-muted-foreground">{item.detail}</p>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {skill.lessonId && <Link href={`/roadmap/${roadmapId}/lesson/${skill.lessonId}`} className="mt-2 inline-block text-xs text-primary underline">{skill.lessonTitle}</Link>}
              </article>
            ))}
            {report.skills.length === 0 && <p className="text-sm text-muted-foreground">No mapped skills are available for this roadmap yet.</p>}
          </div>
          {compact && report.skills.length > skills.length && (
            <p className="mt-3 text-xs text-muted-foreground">Showing {skills.length} of {report.skills.length} skills.</p>
          )}
          {!report.roadmapCompleted && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              To finalize: {report.completionRequirements.lessonsPassed ? "lessons complete" : "pass all roadmap lessons"}
              {" · "}
              {report.completionRequirements.phaseExamsPassed ? "phase quizzes complete" : "pass every phase mastery quiz"}
            </p>
          )}
        </>
      )}
      </>}
    </Card>
  )
}
