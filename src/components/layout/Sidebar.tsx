"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Map, GraduationCap, BarChart3, Settings, LogOut, Menu, X, SquareCode, ChevronLeft, ChevronRight, ClipboardCheck, Library } from "lucide-react"
import { useEffect, useState } from "react"
import { useClerk } from "@clerk/nextjs"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/roadmap", label: "Roadmap", icon: Map },
  { href: "/tutor", label: "Tutor", icon: GraduationCap },
  { href: "/code-e", label: "Code Editor", icon: SquareCode },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/roadmaps", label: "Public Library", icon: Library },
  { href: "/review", label: "Review Queue", icon: ClipboardCheck },
]

export function Sidebar() {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const { signOut } = useClerk()

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("hipath_sidebar_collapsed") === "1")
    } catch {}
    void fetch("/api/me/review-queue", { cache: "no-store" }).then((res) => {
      if (res.ok) setIsAdmin(true)
    }).catch(() => {})
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem("hipath_sidebar_collapsed", next ? "1" : "0")
      } catch {}
      return next
    })
  }

  const handleSignOut = () => {
    setSigningOut(true)
    try {
      if (signOut) {
        void signOut(() => { window.location.href = "/" })
        return
      }
    } catch {}
    try { localStorage.clear() } catch {}
    window.location.href = "/"
  }

  const renderInner = (isCollapsed: boolean) => (
    <div className="flex flex-col h-full">
      <div className={cn("h-14 flex items-center border-b border-border", isCollapsed ? "justify-center px-2" : "gap-2 px-4")}>
        <Link href="/dashboard" className="flex items-center gap-2 hover:bg-muted rounded-lg px-1 py-1" onClick={() => setOpen(false)}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">H</div>
          {!isCollapsed && <div><div className="text-sm font-bold leading-none">HiPath</div><div className="text-[10px] leading-none text-muted-foreground">AI</div></div>}
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.filter((item) => item.href !== "/review" || isAdmin).map((item) => {
          const isActive = item.href === "/dashboard" ? path === "/dashboard" : item.href === "/roadmap" ? path.startsWith("/roadmap") : path === item.href || path.startsWith(item.href + "/")
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              title={isCollapsed ? item.label : undefined}
              aria-label={item.label}
              className={cn(
                "flex items-center rounded-lg text-sm transition-colors",
                isCollapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
        <div className="pt-4 space-y-1">
          <button
            onClick={() => setConfirmSignOut(true)}
            title={isCollapsed ? "Sign out" : undefined}
            aria-label="Sign out"
            className={cn(
              "flex items-center rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground w-full text-left transition-colors",
              isCollapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2"
            )}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Sign out</span>}
          </button>
          <button
            onClick={toggleCollapsed}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!isCollapsed}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "hidden md:flex items-center rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground w-full text-left transition-colors",
              isCollapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2"
            )}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <ChevronLeft className="w-4 h-4 shrink-0" />}
            {!isCollapsed && <span>Collapse</span>}
          </button>
        </div>
      </nav>
    </div>
  )

  const dialog = (
    <ConfirmDialog
      open={confirmSignOut}
      title="Sign out?"
      description="Your roadmaps, progress, and streaks are saved to your account. See you soon!"
      confirmLabel="Sign out"
      busy={signingOut}
      onConfirm={handleSignOut}
      onClose={() => { if (!signingOut) setConfirmSignOut(false) }}
    />
  )

  return (
    <>
      <button onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"} className="md:hidden fixed top-3 left-3 z-30 min-h-[44px] min-w-[44px] inline-flex items-center justify-center bg-card rounded-lg border border-border shadow">{open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}</button>
      <aside className={cn("hidden md:flex border-r border-border bg-app flex-col shrink-0 transition-all duration-200 sticky top-0 h-screen", collapsed ? "w-16" : "w-56")}>{renderInner(collapsed)}</aside>
      {open && <div className="fixed inset-0 z-20 md:hidden"><div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} /><aside className="absolute left-0 top-0 bottom-0 w-64 bg-app shadow-xl">{renderInner(false)}</aside></div>}
      {dialog}
    </>
  )
}
