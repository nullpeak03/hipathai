"use client"

import Link from "next/link"
import { ArrowRight, PlayCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export type MobileContinueCta =
  | { label: string; href: string; onClick?: never }
  | { label: string; href?: never; onClick: () => void }

type MobileContinueBarProps = {
  pct: number
  label: string
  title: string
  detail?: string
  cta: MobileContinueCta
}

export function MobileContinueBar({ pct, label, title, detail, cta }: MobileContinueBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur lg:hidden">
      <div className="h-1 bg-muted" aria-hidden>
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-3 px-4 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-medium">{title}</p>
          {detail ? <p className="truncate text-[11px] text-muted-foreground">{detail}</p> : null}
        </div>
        {cta.href ? (
          <Button asChild size="sm" className="shrink-0">
            <Link href={cta.href}>
              <PlayCircle className="mr-1 h-4 w-4" aria-hidden />
              {cta.label}
            </Link>
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={cta.onClick} className="shrink-0">
            {cta.label}
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  )
}
