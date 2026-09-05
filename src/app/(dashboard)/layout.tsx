"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SignOutButton, UserButton, useUser } from "@clerk/nextjs"
import {
  BarChart3, BookOpen, BriefcaseBusiness, ChevronLeft, ChevronRight, LayoutDashboard,
  LogOut, Menu, MessageSquare, PanelLeftClose, PanelLeftOpen, Settings, User, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Roadmaps", href: "/dashboard/roadmaps", icon: BookOpen },
  { name: "Projects", href: "/dashboard/projects", icon: BriefcaseBusiness },
  { name: "AI Tutor", href: "/dashboard/tutor", icon: MessageSquare },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Profile", href: "/dashboard/profile", icon: User },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useUser()
  const [expanded, setExpanded] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  const sidebar = (
    <aside className={cn(
      "dashboard-sidebar fixed inset-y-0 left-0 z-50 flex w-[276px] flex-col border-r border-white/10 bg-[#0a1020]/95 p-4 shadow-2xl shadow-black/20 backdrop-blur-2xl transition-transform duration-300 lg:static lg:translate-x-0",
      expanded ? "lg:w-[276px]" : "lg:w-[88px]",
      mobileOpen ? "translate-x-0" : "-translate-x-full",
    )}>
      <div className="flex h-16 items-center justify-between">
        <Logo href="/dashboard" compact={!expanded} />
        <button onClick={() => setMobileOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close navigation"><X className="h-5 w-5" /></button>
      </div>
      <div className="mt-8 flex-1">
        <p className={cn("mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500", !expanded && "text-center")}>{expanded ? "Workspace" : "·"}</p>
        <nav className="space-y-2">
          {navigation.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`))
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} title={!expanded ? item.name : undefined}
                className={cn("group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-400 transition-all hover:bg-white/[0.07] hover:text-white", active && "bg-gradient-to-r from-violet-500/20 to-cyan-400/10 text-white shadow-[inset_0_0_0_1px_rgba(124,92,252,.25)]", !expanded && "justify-center")}>
                <item.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-cyan-200" : "text-slate-500 group-hover:text-cyan-200")} />
                {expanded && <span>{item.name}</span>}
                {expanded && active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#55d6ff]" />}
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="space-y-3 border-t border-white/10 pt-4">
        {expanded && <div className="rounded-2xl border border-violet-300/15 bg-gradient-to-br from-violet-500/15 to-cyan-400/5 p-4"><p className="text-xs font-medium text-cyan-100">Adaptive mode</p><p className="mt-1 text-xs leading-5 text-slate-400">Your path adjusts as you learn.</p></div>}
        <SignOutButton><button className={cn("flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-400 hover:bg-rose-400/10 hover:text-rose-200", !expanded && "justify-center")} title={!expanded ? "Sign out" : undefined}><LogOut className="h-[18px] w-[18px]" />{expanded && "Sign out"}</button></SignOutButton>
      </div>
    </aside>
  )

  return (
    <div className="dashboard-theme min-h-screen bg-[#080d1c] text-slate-100">
      {sidebar}
      {mobileOpen && <button className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay" />}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-white/10 bg-[#080d1c]/80 px-4 backdrop-blur-2xl sm:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-slate-300 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></Button>
            <button onClick={() => setExpanded((value) => !value)} className="hidden rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-400 hover:text-white lg:block" aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}>{expanded ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}</button>
            <div className="hidden sm:block"><p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Adaptive learning workspace</p><p className="mt-1 text-sm text-slate-300">{pathname === "/dashboard" ? "Your learning command center" : "Keep your momentum moving forward"}</p></div>
          </div>
          <div className="flex items-center gap-3"><div className="hidden items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-2 text-xs text-cyan-100 sm:flex"><span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_#55d6ff]" />{user?.firstName || "Learner"} is learning</div><UserButton /></div>
        </header>
        <main className="flex-1 bg-[radial-gradient(circle_at_80%_0%,rgba(124,92,252,.14),transparent_32rem)] p-4 sm:p-8 lg:p-10"><div className="mx-auto w-full max-w-[1500px]">{children}</div></main>
      </div>
    </div>
  )
}
