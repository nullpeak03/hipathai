import { cn } from "@/lib/utils"

/**
 * Shared skeleton shell for authenticated routes. Mirrors the Sidebar + Header
 * layout so navigation to a slow page never jumps from a blank screen to the
 * full app shell.
 */
export function AppLoading({
  children,
  mainClassName,
  fullHeight = false,
}: {
  children: React.ReactNode
  mainClassName?: string
  fullHeight?: boolean
}) {
  return (
    <div className={cn("flex bg-app", fullHeight ? "h-dvh overflow-hidden" : "min-h-screen")}>
      <div className="hidden w-56 shrink-0 border-r border-border bg-app md:block" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-14 shrink-0 border-b border-border bg-card" />
        <main className={cn("w-full", mainClassName ?? "mx-auto max-w-7xl p-4 sm:p-6")}>{children}</main>
      </div>
    </div>
  )
}
