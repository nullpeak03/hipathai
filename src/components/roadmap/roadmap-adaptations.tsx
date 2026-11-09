"use client"

import { ChevronDown, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { IconBadge } from "@/components/ui/icon-badge"
import type { ReplanProposalRecord, RoadmapRevisionRecord } from "@/lib/store"

type ProposedTopic = { topic: string; failCount: number | null }

function getProposedTopics(proposal: ReplanProposalRecord): ProposedTopic[] {
  const entries = proposal.proposed_changes.topics
  if (!Array.isArray(entries)) return []
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return []
    const value = entry as { topic?: unknown; failCount?: unknown }
    return typeof value.topic === "string"
      ? [{ topic: value.topic, failCount: typeof value.failCount === "number" ? value.failCount : null }]
      : []
  })
}

type PendingAdaptationsProps = {
  proposals: ReplanProposalRecord[]
  busy: boolean
  failedJobs: Record<string, string[]>
  onApply: (proposal: ReplanProposalRecord) => void
  onDismiss: (proposal: ReplanProposalRecord) => void
  onRetry: (proposalId: string, jobIds: string[]) => void
}

export function PendingAdaptations({
  proposals,
  busy,
  failedJobs,
  onApply,
  onDismiss,
  onRetry,
}: PendingAdaptationsProps) {
  const pending = proposals.filter((proposal) => proposal.status === "pending")
  const failedCount = Object.keys(failedJobs).length
  if (pending.length === 0 && failedCount === 0) return null

  return (
    <Card className="border-warn-border bg-warn-bg/50 p-4 sm:p-5" aria-live="polite">
      <div className="flex items-start gap-3">
        <IconBadge icon={Sparkles} size="sm" tone="warn" />
        <div>
          <h2 className="text-sm font-semibold text-warn-fg">Roadmap adaptations</h2>
          <p className="mt-0.5 text-xs text-warn-fg">
            {pending.length > 0
              ? "These changes are suggestions. Nothing is added until you apply them."
              : "Some focused-practice lessons still need generation. Retry them below."}
          </p>
        </div>
      </div>

      {pending.length > 0 ? (
        <div className="mt-4 space-y-3">
          {pending.map((proposal) => {
          const topics = getProposedTopics(proposal)
          return (
            <div key={proposal.id} className="rounded-xl border border-warn-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-warn-fg">Suggested change — awaiting your decision</p>
                <span className="rounded-full border border-warn-border bg-warn-bg px-2 py-0.5 text-[10px] font-medium text-warn-fg">
                  Pending
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{proposal.reason}</p>
              {topics.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-foreground">
                  {topics.map(({ topic, failCount }) => (
                    <li key={topic}>
                      Add focused practice for <strong>{topic}</strong>
                      {failCount !== null ? ` (missed ${failCount} times)` : ""}.
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  This older request has no saved change preview. Dismiss it and request a fresh proposal to
                  review concrete changes.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onApply(proposal)}
                  disabled={busy || topics.length === 0}
                >
                  Apply changes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDismiss(proposal)}
                  disabled={busy}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )
        })}
        </div>
      ) : null}

      {Object.entries(failedJobs).length > 0 ? (
        <div className="mt-3 space-y-2">
          {Object.entries(failedJobs).map(([proposalId, jobIds]) => (
            <div
              key={proposalId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warn-border bg-card p-3"
            >
              <p className="text-xs text-warn-fg">
                {jobIds.length} focused-practice lesson{jobIds.length === 1 ? "" : "s"} could not be queued yet.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onRetry(proposalId, jobIds)}
                disabled={busy}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Retry generation
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  )
}

type AdaptationHistoryProps = {
  revisions: RoadmapRevisionRecord[]
}

export function AdaptationHistory({ revisions }: AdaptationHistoryProps) {
  if (revisions.length === 0) return null

  return (
    <details className="group mt-6 rounded-2xl border border-border bg-card p-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">
        <span>Applied roadmap changes ({revisions.length})</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="mt-3 space-y-3 border-t border-border pt-3">
        {revisions.map((revision) => {
          const topics = Array.isArray(revision.changes?.topics)
            ? revision.changes.topics.filter((topic): topic is string => typeof topic === "string")
            : []
          return (
            <li key={revision.id} className="text-xs">
              <p>{topics.length > 0 ? `Added focused practice for ${topics.join(", ")}.` : revision.reason}</p>
              {topics.length > 0 ? <p className="mt-0.5 text-muted-foreground">{revision.reason}</p> : null}
              <time className="mt-0.5 block text-[10px] text-muted-foreground" dateTime={revision.created_at}>
                {new Date(revision.created_at).toLocaleDateString()}
              </time>
            </li>
          )
        })}
      </ul>
    </details>
  )
}
