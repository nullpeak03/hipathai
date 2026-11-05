"use client"

import { Minus, Plus, X } from "lucide-react"
import type { EditorSettings } from "@/lib/code/editor-settings"

function Segment({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-2.5 py-1 rounded-md text-xs border ${
        active ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}

export function SettingsPopover({
  open,
  onClose,
  settings,
  onChange,
}: {
  open: boolean
  onClose: () => void
  settings: EditorSettings
  onChange: (patch: Partial<EditorSettings>) => void
}) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label="Editor settings"
        className="absolute right-0 top-full mt-2 z-40 w-72 rounded-xl border border-border bg-card shadow-xl p-3"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold">Editor settings</span>
          <button type="button" onClick={onClose} aria-label="Close settings" className="p-1 rounded hover:bg-muted">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Font size</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onChange({ fontSize: Math.max(12, settings.fontSize - 1) })}
                disabled={settings.fontSize <= 12}
                aria-label="Decrease font size"
                className="p-1 rounded border border-border hover:bg-muted disabled:opacity-40"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-7 text-center font-mono">{settings.fontSize}</span>
              <button
                type="button"
                onClick={() => onChange({ fontSize: Math.min(20, settings.fontSize + 1) })}
                disabled={settings.fontSize >= 20}
                aria-label="Increase font size"
                className="p-1 rounded border border-border hover:bg-muted disabled:opacity-40"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Line wrap</span>
            <Segment active={settings.wrap} onClick={() => onChange({ wrap: !settings.wrap })}>
              {settings.wrap ? "On" : "Off"}
            </Segment>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Tab size</span>
            <div className="flex gap-1">
              <Segment active={settings.tabSize === 2} onClick={() => onChange({ tabSize: 2 })}>2</Segment>
              <Segment active={settings.tabSize === 4} onClick={() => onChange({ tabSize: 4 })}>4</Segment>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Output</span>
            <div className="flex gap-1">
              <Segment active={settings.layout === "bottom"} onClick={() => onChange({ layout: "bottom" })}>Bottom</Segment>
              <Segment active={settings.layout === "right"} onClick={() => onChange({ layout: "right" })}>Right</Segment>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">File tree</span>
            <Segment active={settings.treeOpen} onClick={() => onChange({ treeOpen: !settings.treeOpen })}>
              {settings.treeOpen ? "Shown" : "Hidden"}
            </Segment>
          </div>
        </div>
        <p className="mt-3 pt-2 border-t border-border text-[10px] text-muted-foreground">
          Saved on this device. Cloud sync arrives with Pro.
        </p>
      </div>
    </>
  )
}
