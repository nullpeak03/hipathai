"use client"

import { useState } from "react"
import { Check, Zap } from "lucide-react"

export function PanelShell({ title, language, action, children }: {
  title?: string
  language: string
  action: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="mt-4 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between mb-2 px-3 pt-2">
        <div className="text-xs font-semibold text-muted-foreground">
          {title ?? "EXAMPLE"} <span className="font-normal">· {language}</span>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      {children}
    </div>
  )
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void (async () => {
          try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          } catch {
            // clipboard unavailable
          }
        })()
      }}
      className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1"
    >
      {copied ? <span className="inline-flex items-center gap-1">Copied <Check className="w-3 h-3" /></span> : label}
    </button>
  )
}

/** Read-only panel (non-runnable languages + fallback). Matches lesson styling. */
export function StaticCodePanel({ code, language, title }: { code: string; language: string; title?: string }) {
  return (
    <PanelShell title={title} language={language} action={<CopyButton text={code} />}>
      <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-xl overflow-x-auto text-sm"><code>{code}</code></pre>
    </PanelShell>
  )
}

export function ProUpgradeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label="Pro feature">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border border-border shadow-xl max-w-sm w-full p-6">
        <h3 className="font-semibold flex items-center gap-1.5">Code Runner is planned for Pro <Zap className="w-4 h-4 text-primary" /></h3>
        <p className="text-sm text-muted-foreground mt-2">
          Pro is coming soon. See the planned features and pricing, or keep
          learning with the free experience.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <a href="/pricing" className="inline-flex items-center justify-center rounded-lg border border-border text-sm font-medium h-10 px-4 hover:bg-muted">
            See planned Pro
          </a>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg text-sm font-medium h-10 px-6 py-2 bg-primary text-primary-foreground hover:bg-primary-hover"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
