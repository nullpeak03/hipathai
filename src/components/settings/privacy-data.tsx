"use client"

import { useState } from "react"
import Link from "next/link"
import { useClerk, useUser } from "@clerk/nextjs"
import { Download, FileJson, ShieldAlert, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { IconBadge } from "@/components/ui/icon-badge"
import { useToast } from "@/components/ui/toast"
import {
  loadGamAsync,
  loadProgressAsync,
  loadRoadmapAsync,
  loadWeakTopics,
} from "@/lib/store"

export function PrivacyData() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const toast = useToast()
  const [exporting, setExporting] = useState(false)
  const [lastExportAt, setLastExportAt] = useState<Date | null>(null)
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  const exportData = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const [roadmap, gam, progress, weakTopics, threadsRes, activityRes, prefsRes, capstoneRes] =
        await Promise.all([
          loadRoadmapAsync(),
          loadGamAsync(),
          loadProgressAsync(),
          loadWeakTopics(),
          fetch("/api/chat/threads", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch("/api/me/daily-activity?days=90", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch("/api/me/preferences", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch("/api/me/capstone-evidence", { cache: "no-store" }).then(async (r) => {
            const data = await r.json().catch(() => ({}))
            if (!r.ok) throw new Error(data.error || "Could not export capstone evidence.")
            return data
          }),
        ])

      const readinessRes = roadmap?.id
        ? await fetch(`/api/me/skill-readiness?roadmapId=${encodeURIComponent(roadmap.id)}`, {
            cache: "no-store",
          })
        : null
      const readinessData = readinessRes ? await readinessRes.json().catch(() => ({})) : null
      if (readinessRes && !readinessRes.ok) {
        throw new Error(readinessData?.error || "Could not export skill readiness.")
      }

      const threads = (threadsRes as { threads?: { id: string }[] } | null)?.threads ?? []
      const chatThreads = await Promise.all(
        threads.map(async (thread) => {
          try {
            const response = await fetch(`/api/chat/threads/${thread.id}`, { cache: "no-store" })
            const data = response.ok ? await response.json() : null
            return { ...thread, messages: data?.messages ?? null }
          } catch {
            return { ...thread, messages: null }
          }
        })
      )

      const bundle = {
        exportedAt: new Date().toISOString(),
        profile: user
          ? {
              fullName: user.fullName,
              email: user.primaryEmailAddress?.emailAddress,
            }
          : null,
        gamification: gam,
        progress,
        roadmap,
        weakTopics,
        chatThreads,
        dailyActivity: (activityRes as { days?: unknown } | null)?.days ?? null,
        preferences: prefsRes,
        capstoneEvidence: (capstoneRes as { evidence?: unknown }).evidence ?? [],
        skillReadiness: readinessData?.report ?? null,
      }

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `hipath-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setLastExportAt(new Date())
      toast({ title: "Export ready", message: "Your data downloaded as JSON.", kind: "success" })
    } catch (error) {
      toast({
        title: "Export failed",
        message: error instanceof Error ? error.message : "Could not assemble your data. Try again.",
        kind: "error",
      })
    } finally {
      setExporting(false)
    }
  }

  const deleteAccount = async () => {
    setDeletingAccount(true)
    try {
      const res = await fetch("/api/me/account", { method: "DELETE" })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        toast({
          title: "Delete failed",
          message: data.error || "Could not delete your account.",
          kind: "error",
        })
        return
      }
      try {
        localStorage.clear()
      } catch {}
      try {
        if (signOut) {
          await signOut(() => {
            window.location.href = "/"
          })
        } else {
          window.location.href = "/"
        }
      } catch {
        window.location.href = "/"
      }
    } finally {
      setDeletingAccount(false)
      setConfirmDeleteAccount(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2.5">
            <IconBadge icon={FileJson} size="sm" tone="muted" />
            <div>
              <h3 className="text-sm font-semibold">Export your data</h3>
              <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
                Download a JSON bundle with your profile, roadmap, progress, mastery, chats, activity,
                preferences, capstone evidence, and skill readiness.
              </p>
              {lastExportAt ? (
                <p className="mt-2 text-[11px] text-ok-fg">
                  Last export requested at{" "}
                  {lastExportAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}.
                </p>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit shrink-0 gap-1.5"
            onClick={() => void exportData()}
            disabled={exporting}
          >
            <Download className="h-4 w-4" aria-hidden />
            {exporting ? "Preparing…" : "Download JSON"}
          </Button>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-2.5">
          <IconBadge icon={ShieldAlert} size="sm" tone="muted" />
          <div>
            <h3 className="text-sm font-semibold">Policies</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              How HiPath stores, uses, and protects your data.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/privacy">Privacy Policy</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/terms">Terms of Service</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/cookies">Cookie Policy</Link>
          </Button>
        </div>
      </Card>

      <Card className="border-danger-border p-4 sm:p-5">
        <div className="flex items-start gap-2.5">
          <IconBadge icon={Trash2} size="sm" tone="danger" />
          <div>
            <h3 className="text-sm font-semibold">Danger zone</h3>
            <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
              Permanently delete your account and all learning data: roadmaps, progress, chats, mastery,
              streak history, and preferences. This cannot be undone.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 gap-1.5 border-danger-border text-danger-fg hover:bg-danger-bg"
          onClick={() => setConfirmDeleteAccount(true)}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Delete account…
        </Button>

        <ConfirmDialog
          open={confirmDeleteAccount}
          title="Delete your account?"
          description="This permanently removes your profile, roadmaps, progress, chats, and streaks. This cannot be undone."
          confirmLabel="Delete everything"
          danger
          busy={deletingAccount}
          onConfirm={() => void deleteAccount()}
          onClose={() => {
            if (!deletingAccount) setConfirmDeleteAccount(false)
          }}
        />
      </Card>
    </div>
  )
}
