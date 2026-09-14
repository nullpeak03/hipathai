"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Map, GraduationCap, Bot, Diamond, BarChart3, Settings, LogOut, Menu, X } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/roadmap", label: "Roadmap", icon: Map },
  { href: "/tutor", label: "Tutor", icon: GraduationCap },
  { href: "/tutor", label: "AI Mentor", icon: Bot, sub: true },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const inner = (
    <div className="flex flex-col h-full">
      <div className="h-14 flex items-center gap-2 px-4 border-b dark:border-zinc-800">
        <div className="w-8 h-8 rounded-lg bg-[#6C5BFF] flex items-center justify-center text-white font-bold">H</div>
        <div><div className="text-sm font-bold leading-none">HiPath</div><div className="text-[10px] leading-none text-zinc-500">AI</div></div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(item => {
          const active = path.startsWith(item.href) && (item.label==="Dashboard"? path==="/dashboard" : item.label==="Roadmap"? path.startsWith("/roadmap") : item.label==="Analytics"? path==="/analytics" : item.label==="Tutor"? false : true) || (item.label==="AI Mentor" && path.startsWith("/tutor"))
          const isTutor = item.label==="Tutor" && path==="/tutor"
          const isActive = item.label==="Dashboard" ? path==="/dashboard" : item.label==="Roadmap" ? path.startsWith("/roadmap") : item.label==="Tutor" ? isTutor : item.label==="AI Mentor" ? false : path===item.href
          return (
            <Link key={item.label} href={item.href} onClick={()=>setOpen(false)} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm", isActive || active ? "bg-[#6C5BFF] text-white" : "text-zinc-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800")}>
              <item.icon className="w-4 h-4" /> {item.label}
            </Link>
          )
        })}
        <div className="pt-4">
          <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"><LogOut className="w-4 h-4" /> Sign out</Link>
        </div>
      </nav>
    </div>
  )
  return (
    <>
      <button onClick={()=>setOpen(!open)} className="md:hidden fixed top-3 left-3 z-30 p-2 bg-white dark:bg-zinc-900 rounded-lg border shadow">{open? <X className="w-4 h-4"/> : <Menu className="w-4 h-4"/>}</button>
      <aside className="hidden md:flex w-56 border-r bg-gray-50/50 dark:bg-zinc-900 dark:border-zinc-800 flex-col shrink-0">{inner}</aside>
      {open && <div className="fixed inset-0 z-20 md:hidden"><div className="absolute inset-0 bg-black/30" onClick={()=>setOpen(false)} /><aside className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-zinc-900 shadow-xl">{inner}</aside></div>}
    </>
  )
}
