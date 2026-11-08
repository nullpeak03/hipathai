"use client"

import { Accessibility, Contrast, Eye, Waves } from "lucide-react"
import { Card } from "@/components/ui/card"
import { IconBadge } from "@/components/ui/icon-badge"
import { usePreferences } from "@/components/settings/preferences-provider"
import { ToggleRow } from "@/components/settings/toggle-row"
import { FONT_SIZE_MAX, FONT_SIZE_MIN, clampFontSize } from "@/lib/settings-prefs"

export function AccessibilitySettings() {
  const { draft, updatePreference } = usePreferences()
  if (!draft) return null

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-2.5">
          <IconBadge icon={Accessibility} size="sm" tone="muted" />
          <div>
            <h3 className="text-sm font-semibold">Comfort</h3>
            <p className="text-xs text-muted-foreground">Reduce visual effort while you learn.</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <ToggleRow
            id="settings-reduced-motion"
            label="Reduced motion"
            description="Disable non-essential animation and smooth scrolling."
            checked={draft.reducedMotion}
            onChange={(checked) => updatePreference("reducedMotion", checked)}
          />
          <ToggleRow
            id="settings-high-contrast"
            label="High contrast"
            description="Strengthen borders, surfaces, and text separation."
            checked={draft.highContrast}
            onChange={(checked) => updatePreference("highContrast", checked)}
          />
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <IconBadge icon={Eye} size="sm" tone="muted" />
            <div>
              <h3 className="text-sm font-semibold">Text size</h3>
              <p className="text-xs text-muted-foreground">Adjust the base size for the whole app.</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium tabular-nums">
            {clampFontSize(draft.fontSize)}px
          </span>
        </div>

        <div className="mt-4">
          <input
            type="range"
            aria-label="Base font size"
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            step={1}
            value={clampFontSize(draft.fontSize)}
            onChange={(event) => updatePreference("fontSize", Number(event.target.value))}
            className="w-full accent-[var(--primary)]"
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{FONT_SIZE_MIN}px</span>
            <span>{FONT_SIZE_MAX}px</span>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-app/50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
          <p className="mt-1.5 text-sm">
            The quick brown fox jumps over the lazy dog while you review your next lesson.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Explanations, quiz options, and navigation all follow this base size.
          </p>
        </div>

        <div className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground">
          <Waves className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <p>Preview applies immediately. Choose Save changes to keep it after you leave this page.</p>
        </div>
      </Card>

      <Card className="flex items-start gap-2.5 p-4 text-[11px] text-muted-foreground sm:p-5">
        <Contrast className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <p>
          These settings are stored with your account, so the same comfort options follow you to other
          devices. Your device may also have its own accessibility controls.
        </p>
      </Card>
    </div>
  )
}
