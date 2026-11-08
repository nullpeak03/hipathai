import type { LucideIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import { IconBadge } from "@/components/ui/icon-badge"
import { cn } from "@/lib/utils"

type WidgetShellProps = {
  icon: LucideIcon
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/** Shared bento card framing: icon, title, optional action, and content. */
export function WidgetShell({ icon, title, subtitle, action, className, children }: WidgetShellProps) {
  return (
    <Card className={cn("flex h-full flex-col p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconBadge icon={icon} size="sm" tone="muted" />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{title}</h2>
            {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </Card>
  )
}
