"use client"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useEffect, useState } from "react"

type Item = { id: string; roadmap_id: string; reason: string; created_at: string }

export default function ReviewPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

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
    await fetch("/api/me/review-queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })
    await load()
  }

  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-4 sm:p-6 max-w-5xl w-full mx-auto">
          <h1 className="text-2xl font-bold">Roadmap Review Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">Review generated roadmaps before publishing.</p>
          {forbidden ? <div className="mt-6 text-sm text-danger-fg">Only the admin account can review roadmaps.</div> : null}
          {loading ? <div className="mt-6 text-sm text-muted-foreground">Loading…</div> : null}
          <div className="mt-6 space-y-3">
            {items.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="text-sm font-medium">Roadmap {item.roadmap_id}</div>
                <div className="text-xs text-muted-foreground mt-1">{item.reason}</div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => void decide(item.id, "approved")}>Approve & Publish</Button>
                  <Button size="sm" variant="outline" onClick={() => void decide(item.id, "rejected")}>Reject</Button>
                </div>
              </Card>
            ))}
            {!loading && items.length === 0 && <div className="text-sm text-muted-foreground">No pending roadmaps.</div>}
          </div>
        </main>
      </div>
    </div>
  )
}
