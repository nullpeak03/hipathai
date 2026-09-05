"use client"

import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/80">{eyebrow}</p>}
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{title}</h1>
        {description && <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </div>
  )
}

export function DashboardSurface({ className, children, ...props }: { className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("dashboard-surface rounded-3xl p-5 sm:p-6", className)} {...props}>{children}</section>
}

export function DashboardStat({
  label,
  value,
  detail,
  icon: Icon,
  tone = "violet",
}: {
  label: string
  value: string | number
  detail: string
  icon: LucideIcon
  tone?: "violet" | "cyan" | "amber" | "rose"
}) {
  return (
    <DashboardSurface className="relative overflow-hidden">
      <div className={cn("absolute -right-8 -top-8 h-24 w-24 rounded-full blur-3xl", {
        "bg-violet-500/20": tone === "violet",
        "bg-cyan-400/20": tone === "cyan",
        "bg-amber-400/20": tone === "amber",
        "bg-rose-400/20": tone === "rose",
      })} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p>
          <p className="mt-2 text-sm text-slate-400">{detail}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-cyan-200"><Icon className="h-5 w-5" /></div>
      </div>
    </DashboardSurface>
  )
}

export function DashboardEmptyState({ icon: Icon, title, description, action }: {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <DashboardSurface className="flex min-h-64 flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-cyan-200"><Icon className="h-7 w-7" /></div>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </DashboardSurface>
  )
}
