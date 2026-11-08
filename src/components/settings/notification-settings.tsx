"use client"

import { Bell, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { IconBadge } from "@/components/ui/icon-badge"
import { usePreferences } from "@/components/settings/preferences-provider"
import { ToggleRow } from "@/components/settings/toggle-row"

export function NotificationSettings({ onManageEmail }: { onManageEmail: () => void }) {
  const { draft, updatePreference } = usePreferences()
  if (!draft) return null

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-2.5">
          <IconBadge icon={Bell} size="sm" tone="muted" />
          <div>
            <h3 className="text-sm font-semibold">Email notifications</h3>
            <p className="text-xs text-muted-foreground">Only the essentials, never a newsletter.</p>
          </div>
        </div>

        <div className="mt-4">
          <ToggleRow
            id="settings-streak-reminders"
            label="Streak reminders"
            description={
              draft.email
                ? "One email a day, only when an active streak has no study time yet."
                : "Add an email address before reminders can be delivered."
            }
            checked={draft.emailReminders}
            onChange={(checked) => updatePreference("emailReminders", checked)}
            disabled={!draft.email}
          />
        </div>

        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-border bg-app/50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2.5">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-medium">Delivered to</p>
              <p className="truncate text-sm">{draft.email ?? "No email on file"}</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onManageEmail} className="w-fit shrink-0">
            {draft.email ? "Manage email" : "Add email"}
          </Button>
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Reminders are sent at most once per day. You can turn them off at any time; learning emails about
          account security are separate.
        </p>
      </Card>

      <Card className="p-4 sm:p-5">
        <h3 className="text-sm font-semibold">What you will not get</h3>
        <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
          <li>· Marketing blasts or product newsletters.</li>
          <li>· More than one reminder email per day.</li>
          <li>· Messages from other learners.</li>
        </ul>
      </Card>
    </div>
  )
}
