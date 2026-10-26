"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Input } from "@/components/ui/input"
import { isAllowedEvidenceUrl, type CapstoneEvidenceRecord } from "@/lib/capstone-evidence"

type EvidenceDraft = {
  projectSummary: string
  repositoryUrl: string
  deploymentUrl: string
  implementationComplete: boolean
  validationComplete: boolean
  documentationComplete: boolean
  reflection: string
}

const EMPTY_DRAFT: EvidenceDraft = {
  projectSummary: "",
  repositoryUrl: "",
  deploymentUrl: "",
  implementationComplete: false,
  validationComplete: false,
  documentationComplete: false,
  reflection: "",
}

function toDraft(evidence: CapstoneEvidenceRecord): EvidenceDraft {
  return {
    projectSummary: evidence.project_summary,
    repositoryUrl: evidence.repository_url ?? "",
    deploymentUrl: evidence.deployment_url ?? "",
    implementationComplete: evidence.implementation_complete,
    validationComplete: evidence.validation_complete,
    documentationComplete: evidence.documentation_complete,
    reflection: evidence.reflection,
  }
}

export function CapstoneEvidencePanel({ roadmapId, lessonId, lessonTitle }: {
  roadmapId: string
  lessonId: string
  lessonTitle: string
}) {
  const [draft, setDraft] = useState<EvidenceDraft>({ ...EMPTY_DRAFT })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [recordExists, setRecordExists] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState("")
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const endpoint = `/api/me/capstone-evidence?roadmapId=${encodeURIComponent(roadmapId)}&lessonId=${encodeURIComponent(lessonId)}`

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(endpoint, { cache: "no-store" })
      .then(async (res) => {
        const result = await res.json().catch(() => ({})) as { evidence?: CapstoneEvidenceRecord | null; error?: string }
        if (!res.ok) throw new Error(result.error || "Could not load your capstone evidence.")
        if (!active) return
        if (result.evidence) {
          setDraft(toDraft(result.evidence))
          setRecordExists(true)
          setSavedAt(result.evidence.updated_at)
        } else {
          setDraft({ ...EMPTY_DRAFT })
          setRecordExists(false)
          setSavedAt(null)
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load your capstone evidence.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [endpoint])

  const hasEvidence = Boolean(
    draft.projectSummary.trim()
    || draft.repositoryUrl.trim()
    || draft.deploymentUrl.trim()
    || draft.reflection.trim()
    || draft.implementationComplete
    || draft.validationComplete
    || draft.documentationComplete
  )

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    if (!hasEvidence) {
      setError("Add a project summary, evidence link, reflection, or checklist item before saving.")
      return
    }
    if (!isAllowedEvidenceUrl(draft.repositoryUrl) || !isAllowedEvidenceUrl(draft.deploymentUrl)) {
      setError("Use a valid HTTP or HTTPS link without embedded credentials.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/me/capstone-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roadmapId, lessonId, ...draft }),
      })
      const result = await res.json().catch(() => ({})) as { evidence?: CapstoneEvidenceRecord; error?: string }
      if (!res.ok || !result.evidence) throw new Error(result.error || "Could not save your capstone evidence.")
      setDraft(toDraft(result.evidence))
      setRecordExists(true)
      setSavedAt(result.evidence.updated_at)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your capstone evidence.")
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setConfirmDelete(false)
    setError("")
    setSaving(true)
    try {
      const res = await fetch(endpoint, { method: "DELETE" })
      const result = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) throw new Error(result.error || "Could not remove your capstone evidence.")
      setDraft({ ...EMPTY_DRAFT })
      setRecordExists(false)
      setSavedAt(null)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not remove your capstone evidence.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mt-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Capstone evidence</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Record what you built for <strong className="text-foreground">{lessonTitle}</strong> and the skills you demonstrated.
          </p>
        </div>
        <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">Private to you</span>
      </div>
      <p className="mt-3 rounded-lg border border-info-border bg-info-bg p-3 text-xs text-info-fg">
        This optional record is visible only in your account. Add links if you want; HiPath does not upload project files or publish a portfolio page.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground" role="status">Loading your saved evidence…</p>
      ) : (
        <form className="mt-4 space-y-4" onSubmit={(event) => void save(event)}>
          <div>
            <label htmlFor={`capstone-summary-${lessonId}`} className="text-sm font-medium">Project outcome</label>
            <textarea
              id={`capstone-summary-${lessonId}`}
              value={draft.projectSummary}
              maxLength={5000}
              onChange={(event) => setDraft((previous) => ({ ...previous, projectSummary: event.target.value }))}
              placeholder="What did you build? Describe the goal and the key skills you applied."
              className="mt-1 min-h-24 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`capstone-repository-${lessonId}`} className="text-sm font-medium">Repository link <span className="text-muted-foreground">(optional)</span></label>
              <Input
                id={`capstone-repository-${lessonId}`}
                type="url"
                value={draft.repositoryUrl}
                maxLength={2048}
                onChange={(event) => setDraft((previous) => ({ ...previous, repositoryUrl: event.target.value }))}
                placeholder="https://github.com/you/project"
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor={`capstone-deployment-${lessonId}`} className="text-sm font-medium">Working demo <span className="text-muted-foreground">(optional)</span></label>
              <Input
                id={`capstone-deployment-${lessonId}`}
                type="url"
                value={draft.deploymentUrl}
                maxLength={2048}
                onChange={(event) => setDraft((previous) => ({ ...previous, deploymentUrl: event.target.value }))}
                placeholder="https://your-project.example"
                className="mt-1"
              />
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Self-check the evidence</legend>
            {([
              ["implementationComplete", "The project demonstrates the capstone's core outcome."],
              ["validationComplete", "I verified it with tests or a working demo."],
              ["documentationComplete", "I documented setup, key decisions, and limitations."],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft[key]}
                  onChange={(event) => setDraft((previous) => ({ ...previous, [key]: event.target.checked }))}
                  className="h-4 w-4 accent-primary"
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <div>
            <label htmlFor={`capstone-reflection-${lessonId}`} className="text-sm font-medium">Reflection <span className="text-muted-foreground">(optional)</span></label>
            <textarea
              id={`capstone-reflection-${lessonId}`}
              value={draft.reflection}
              maxLength={2000}
              onChange={(event) => setDraft((previous) => ({ ...previous, reflection: event.target.value }))}
              placeholder="What did this project demonstrate, and what would you improve next?"
              className="mt-1 min-h-20 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {error && <p className="text-sm text-danger-fg" role="alert">{error}</p>}
          {savedAt && <p className="text-xs text-muted-foreground" role="status">Saved {new Date(savedAt).toLocaleString()}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={saving || !hasEvidence}>{saving ? "Saving…" : "Save evidence"}</Button>
            {recordExists && (
              <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => setConfirmDelete(true)}>
                Remove evidence
              </Button>
            )}
          </div>
        </form>
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Remove capstone evidence?"
        description="This permanently deletes your private summary, links, checklist, and reflection for this capstone."
        confirmLabel="Remove"
        danger
        busy={saving}
        onConfirm={() => void remove()}
        onClose={() => { if (!saving) setConfirmDelete(false) }}
      />
    </Card>
  )
}
