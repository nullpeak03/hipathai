"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Map, GraduationCap, BarChart3, Settings, LogOut, Menu, X } from "lucide-react"
import { useState } from "react"
import { useClerk } from "@clerk/nextjs"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/roadmap", label: "Roadmap", icon: Map },
  { href: "/tutor", label: "Tutor", icon: GraduationCap },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const { signOut } = useClerk()
  const handleSignOut = () => {
    setSigningOut(true)
    try {
      if (signOut) {
        void signOut(() => { window.location.href = "/" })
        return
      }
    } catch {}
    // fallback: clear local storage and go home
    try { localStorage.clear() } catch {}
    window.location.href = "/"
  }
  const inner = (
    <div className="flex flex-col h-full">
      <Link href="/dashboard" className="h-14 flex items-center gap-2 px-4 border-b border-border hover:bg-muted">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">H</div>
        <div><div className="text-sm font-bold leading-none">HiPath</div><div className="text-[10px] leading-none text-muted-foreground">AI</div></div>
      </Link>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(item => {
          const isActive = item.href === "/dashboard" ? path === "/dashboard" : item.href === "/roadmap" ? path.startsWith("/roadmap") : path === item.href || path.startsWith(item.href + "/")
          return (
            <Link key={item.label} href={item.href} onClick={()=>setOpen(false)} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm", isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <item.icon className="w-4 h-4" /> {item.label}
            </Link>
          )
        })}
        <div className="pt-4">
          <button onClick={()=> setConfirmSignOut(true)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground w-full text-left"><LogOut className="w-4 h-4" /> Sign out</button>
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
      onClose={()=> { if (!signingOut) setConfirmSignOut(false) }}
    />
  )
  return (
    <>
      <button onClick={()=>setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"} className="md:hidden fixed top-3 left-3 z-30 p-2 bg-card rounded-lg border border-border shadow">{open? <X className="w-4 h-4"/> : <Menu className="w-4 h-4"/>}</button>
      <aside className="hidden md:flex w-56 border-r border-border bg-app flex-col shrink-0">{inner}</aside>
      {open && <div className="fixed inset-0 z-20 md:hidden"><div className="absolute inset-0 bg-black/30" onClick={()=>setOpen(false)} /><aside className="absolute left-0 top-0 bottom-0 w-64 bg-app shadow-xl">{inner}</aside></div>}
      {dialog}
    </>
  )
}
