import Link from "next/link"
import {
  ArrowUpRight,
  BarChart3,
  ClipboardCheck,
  GraduationCap,
  Sparkles,
  SquareCode,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { IconBadge } from "@/components/ui/icon-badge"
import { WidgetShell } from "./widget-shell"

type QuickActionsWidgetProps = {
  reviewHref: string
  reviewCount: number
  loaded: boolean
}

type QuickAction = {
  href: string
  label: string
  description: string
  icon: LucideIcon
  tone: "primary" | "info" | "ok" | "warn" | "danger" | "muted"
}

export function QuickActionsWidget({ reviewHref, reviewCount, loaded }: QuickActionsWidgetProps) {
  const actions: QuickAction[] = [
    {
      href: "/onboarding?new=1",
      label: "New roadmap",
      description: "Start a goal",
      icon: Sparkles,
      tone: "primary",
    },
    {
      href: "/tutor",
      label: "Tutor",
      description: "Ask anything",
      icon: GraduationCap,
      tone: "info",
    },
    {
      href: reviewHref,
      label: "Review",
      description: !loaded ? "Checking…" : reviewCount > 0 ? `${reviewCount} due now` : "All clear",
      icon: ClipboardCheck,
      tone: "warn",
    },
    {
      href: "/code-e",
      label: "Code editor",
      description: "Practice code",
      icon: SquareCode,
      tone: "ok",
    },
    {
      href: "/analytics",
      label: "Analytics",
      description: "See trends",
      icon: BarChart3,
      tone: "muted",
    },
  ]

  return (
    <WidgetShell icon={Zap} title="Quick actions" subtitle="Jump back in">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="group flex min-h-[88px] flex-col justify-between gap-3 rounded-xl border border-border bg-app/60 p-3.5 transition-colors hover:border-primary/40 hover:bg-muted"
          >
            <div className="flex items-start justify-between gap-2">
              <IconBadge icon={action.icon} size="sm" tone={action.tone} />
              <ArrowUpRight
                className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden
              />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{action.label}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{action.description}</div>
            </div>
          </Link>
        ))}
      </div>
    </WidgetShell>
  )
}
