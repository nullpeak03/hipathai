"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { useUser, UserButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { MARKETING_LINKS } from "@/lib/marketing-nav"
import { cn } from "@/lib/utils"

function isActive(pathname: string, href: string, anchor?: boolean): boolean {
  if (anchor || href.startsWith("/#")) return false
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function MarketingNav() {
  const pathname = usePathname()
  const { isSignedIn } = useUser()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open])

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold" onClick={close}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">H</span>
          HiPath AI
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
          {MARKETING_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(pathname, link.href, link.anchor) ? "page" : undefined}
              className={cn(
                "transition-colors hover:text-foreground",
                isActive(pathname, link.href, link.anchor) && "font-medium text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {isSignedIn ? (
            <>
              <Link href="/dashboard" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Dashboard
              </Link>
              <UserButton />
            </>
          ) : (
            <>
              <Link href="/sign-in" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Sign in
              </Link>
              <Button asChild>
                <Link href="/sign-up">Get Started Free</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="marketing-mobile-menu"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div
          id="marketing-mobile-menu"
          className="absolute inset-x-4 top-[4.25rem] z-30 rounded-xl border border-border bg-card p-2 shadow-xl lg:hidden"
        >
          <nav aria-label="Mobile navigation">
            {MARKETING_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                className="block rounded-lg px-3 py-2.5 text-sm hover:bg-muted"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-1 space-y-1 border-t border-border pt-2">
            {isSignedIn ? (
              <Link
                href="/dashboard"
                onClick={close}
                className="flex min-h-10 items-center rounded-lg px-3 text-sm hover:bg-muted"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  onClick={close}
                  className="flex min-h-10 items-center rounded-lg px-3 text-sm hover:bg-muted"
                >
                  Sign in
                </Link>
                <Button asChild className="w-full">
                  <Link href="/sign-up" onClick={close}>Get Started Free</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
