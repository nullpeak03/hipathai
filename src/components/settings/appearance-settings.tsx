"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Check, Monitor, Palette } from "lucide-react"
import { Card } from "@/components/ui/card"
import { IconBadge } from "@/components/ui/icon-badge"
import { cn } from "@/lib/utils"

const THEMES = [
  {
    value: "system",
    label: "System",
    description: "Follow your device",
    swatch: "bg-gradient-to-br from-white via-zinc-200 to-zinc-900",
  },
  { value: "light", label: "Light", description: "Bright and clean", swatch: "bg-white" },
  { value: "dark", label: "Dark", description: "Zinc surfaces", swatch: "bg-zinc-950" },
  { value: "matrix", label: "Matrix", description: "Black and terminal green", swatch: "bg-black" },
] as const

export function AppearanceSettings() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <IconBadge icon={Palette} size="sm" tone="muted" />
            <div>
              <h3 className="text-sm font-semibold">Theme</h3>
              <p className="text-xs text-muted-foreground">Pick the look that helps you focus.</p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ok-border bg-ok-bg px-2.5 py-1 text-[10px] font-medium text-ok-fg">
            <Check className="h-3 w-3" aria-hidden />
            Applied instantly
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {THEMES.map((option) => {
            const selected = mounted && theme === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                aria-pressed={selected}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  selected ? "border-primary ring-1 ring-primary/20" : "border-border hover:bg-muted"
                )}
              >
                <div
                  className={cn(
                    "flex h-14 items-center justify-center rounded-lg border border-border",
                    option.swatch
                  )}
                >
                  {option.value === "matrix" ? (
                    <span className="font-mono text-xs text-[#00E676]">&gt;_</span>
                  ) : option.value === "dark" ? (
                    <span className="h-4 w-4 rounded-full bg-zinc-700" />
                  ) : option.value === "light" ? (
                    <span className="h-4 w-4 rounded-full bg-amber-300" />
                  ) : (
                    <span className="h-4 w-4 rounded-full bg-gradient-to-br from-amber-300 to-zinc-700" />
                  )}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-sm font-medium">
                  {option.label}
                  {selected ? <Check className="h-3.5 w-3.5 text-primary" aria-hidden /> : null}
                </div>
                <div className="text-[11px] text-muted-foreground">{option.description}</div>
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-app/50 p-3 text-[11px] text-muted-foreground">
          <Monitor className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <p>
            Theme is stored on this device and applies immediately, so there is nothing to save here. Your
            account preferences and learning settings stay the same on every device.
          </p>
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <h3 className="text-sm font-semibold">Current appearance</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-app/50 px-3 py-2">
            <dt className="text-muted-foreground">Selected theme</dt>
            <dd className="font-medium capitalize">{mounted ? theme : "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-app/50 px-3 py-2">
            <dt className="text-muted-foreground">Rendering as</dt>
            <dd className="font-medium capitalize">{mounted ? resolvedTheme : "—"}</dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}
