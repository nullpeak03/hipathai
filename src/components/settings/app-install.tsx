"use client"

import { CloudOff, Smartphone, WifiOff } from "lucide-react"
import { Card } from "@/components/ui/card"
import { IconBadge } from "@/components/ui/icon-badge"
import { InstallAppCard } from "@/components/pwa/install-app"

export function AppInstall() {
  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-2.5">
          <IconBadge icon={Smartphone} size="sm" tone="muted" />
          <div>
            <h3 className="text-sm font-semibold">Install HiPath AI</h3>
            <p className="text-xs text-muted-foreground">
              Keep learning fullscreen with faster launches and offline access.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <InstallAppCard />
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <div className="flex items-start gap-2.5">
            <IconBadge icon={WifiOff} size="sm" tone="muted" />
            <div>
              <h3 className="text-sm font-semibold">Offline access</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Cached lessons stay readable when your connection drops. Answers and progress sync when you
                are back online.
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4 sm:p-5">
          <div className="flex items-start gap-2.5">
            <IconBadge icon={CloudOff} size="sm" tone="muted" />
            <div>
              <h3 className="text-sm font-semibold">When install is unavailable</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Some browsers, private windows, and iOS versions do not offer installation. The web app still
                works normally in the browser.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
