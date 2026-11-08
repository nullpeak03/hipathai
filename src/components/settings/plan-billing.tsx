"use client"

import Link from "next/link"
import { Check, CreditCard, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { IconBadge } from "@/components/ui/icon-badge"

const FREE_FEATURES = [
  "Guided roadmaps and adaptive lessons",
  "AI tutor, quizzes, and review queue",
  "Progress, analytics, and streak tracking",
  "Offline access after install",
]

export function PlanBilling() {
  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden p-0">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(800px 280px at 8% -20%, var(--ambient-1), transparent 70%), radial-gradient(600px 240px at 96% 0%, var(--ambient-2), transparent 72%)",
          }}
        />
        <div className="relative p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <IconBadge icon={CreditCard} size="md" tone="primary" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold">Free plan</h3>
                  <span className="rounded-full border border-ok-border bg-ok-bg px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ok-fg">
                    Current
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  No card, no trial clock. Core learning stays free.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href="/pricing">Compare plans</Link>
            </Button>
          </div>

          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {FREE_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok-fg" aria-hidden />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <div className="flex items-start gap-2.5">
            <IconBadge icon={Sparkles} size="sm" tone="muted" />
            <div>
              <h3 className="text-sm font-semibold">HiPath Pro</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Planned paid features are still in development. Nothing is available to purchase yet, and your
                current plan will not change automatically.
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4 sm:p-5">
          <h3 className="text-sm font-semibold">Billing details</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-app/50 px-3 py-2">
              <dt className="text-muted-foreground">Payment method</dt>
              <dd className="font-medium">None on file</dd>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-app/50 px-3 py-2">
              <dt className="text-muted-foreground">Invoices</dt>
              <dd className="font-medium">No invoices</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  )
}
