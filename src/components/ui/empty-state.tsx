import type { LucideIcon } from "lucide-react"
import { IconBadge } from "./icon-badge"

/**
 * The one empty state in the app: illustration tile + title + description
 * + optional action. Replaces text-only and emoji-tile empties.
 */
export function EmptyState({ icon, title, description, action, compact }: {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  compact?: boolean
}) {
  return (
    <div className={`text-center px-6 ${compact ? "py-6" : "py-12"}`}>
      <div className="flex justify-center mb-4">
        <IconBadge icon={icon} size={compact ? "sm" : "lg"} tone="info" />
      </div>
      <div className="font-semibold">{title}</div>
      <p className="t-caption mt-1 max-w-sm mx-auto">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}
