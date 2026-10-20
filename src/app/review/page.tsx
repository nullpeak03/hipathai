"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useEffect, useState } from "react"

type Item = {
  id: string
  roadmap_id: string
  user_id: string
  reason: string
  created_at: string
  roadmap: { title: string | null; description: string | null; goal: string | null; level: string | null; lessons_total: number | null } | null
  user: { email: string | null; name: string | null } | null
  phaseCount: number
  lessonCount: number
  phases: { id: string; idx: number; title: string }[]
  similar: { id: string; slug: string; title: string; goal: string }[]
}

export default function ReviewPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    const res = await fetch("/api/me/review-queue", { cache: "no-store" })
    if (res.status === 403) { setForbidden(true); setLoading(false); return }
    const data = await res.json().catch(() => ({}))
    setItems(data.items ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const decide = async (id: string, status: "approved" | "rejected") => {
    if (status === "rejected" && !rejectReason[id]?.trim()) {
      alert("Rejection reason required")
      return
    }
    await fetch("/api/me/review-queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, reason: rejectReason[id] }),
    })
    await load()
  }

  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-4 sm:p-6 max-w-6xl w-full mx-auto">
          <h1 className="text-2xl font-bold">Roadmap Review Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">Review generated roadmaps before publishing.</p>
          {forbidden ? <div className="mt-6 text-sm text-danger-fg">Only the admin account can review roadmaps.</div> : null}
          {loading ? <div className="mt-6 text-sm text-muted-foreground">Loading…</div> : null}
          <div className="mt-6 space-y-4">
            {items.map((item) => (
              <Card key={item.id} className="p-5">
                <div className="flex flex-col gap-2">
                  <div className="text-lg font-semibold">{item.roadmap?.title ?? "Untitled roadmap"}</div>
                  <div className="text-sm text-muted-foreground">{item.roadmap?.description}</div>
                  <div className="text-xs text-muted-foreground">Goal: {item.roadmap?.goal} · Level: {item.roadmap?.level} · {item.phaseCount} phases · {item.lessonCount} lessons</div>
                  <div className="text-xs text-muted-foreground">Requester: {item.user?.name ?? "Unknown"} ({item.user?.email ?? "no email"})</div>
                  <div className="text-xs text-muted-foreground">Reason: {item.reason}</div>
                </div>
                {item.phases.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">Phases</div>
                    <div className="space-y-1">
                      {item.phases.map((phase) => (
                        <div key={phase.id} className="text-xs">- {phase.title}</div>
                      ))}
                    </div>
                  </div>
                )}
                {item.similar.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">Similar existing roadmaps</div>
                    <div className="space-y-1">
                      {item.similar.map((roadmap) => (
                        <div key={roadmap.id} className="text-xs">{roadmap.title} ({roadmap.slug})</div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-4">
                  <textarea
                    value={rejectReason[item.id] ?? ""}
                    onChange={(e) => setRejectReason((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="Rejection reason (required to reject)"
                    className="w-full min-h-[80px] rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => void decide(item.id, "approved")}>Approve & Publish</Button>
                  <Button size="sm" variant="outline" onClick={() => void decide(item.id, "rejected")}>Reject</Button>
                </div>
              </Card>
            ))}
            {!loading && !forbidden && items.length === 0 && <div className="text-sm text-muted-foreground">No pending roadmaps.</div>}
          </div>
        </main>
      </div>
    </div>
  )
}
