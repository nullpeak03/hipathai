import Link from "next/link"
import { MarketingNav } from "./marketing-nav"
import { FOOTER_GROUPS } from "@/lib/marketing-nav"
import { FOUNDER } from "@/lib/founder"
import { cn } from "@/lib/utils"

const WIDTHS = {
  prose: "max-w-3xl",
  default: "max-w-5xl",
  wide: "max-w-6xl",
} as const

type ContainerProps = {
  children: React.ReactNode
  width?: keyof typeof WIDTHS
  className?: string
}

/** Consistent page gutters and rhythm for every public page. */
export function MarketingContainer({ children, width = "default", className }: ContainerProps) {
  return (
    <div className={cn("mx-auto w-full px-5 py-12 sm:px-6 sm:py-16", WIDTHS[width], className)}>
      {children}
    </div>
  )
}

function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Link href="/" className="flex items-center gap-2 font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">H</span>
              HiPath AI
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">
              A personalized AI learning navigator. Free to start, no credit card.
            </p>
          </div>
          {FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</div>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 HiPath AI. All rights reserved.</p>
          <p>
            Built for self-taught learners by{" "}
            <a
              href={FOUNDER.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
            >
              {FOUNDER.name}
            </a>
            , {FOUNDER.role}.
          </p>
        </div>
      </div>
    </footer>
  )
}

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  )
}
