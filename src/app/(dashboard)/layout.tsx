"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar"
import {
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  BarChart3,
  Users,
  Settings,
  LogOut,
  User,
} from "lucide-react"
import { SignOutButton, UserButton, useUser } from "@clerk/nextjs"
import { Logo } from "@/components/brand/logo"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Roadmaps", href: "/dashboard/roadmaps", icon: BookOpen },
  { name: "AI Tutor", href: "/dashboard/tutor", icon: MessageSquare },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Profile", href: "/dashboard/profile", icon: User },
  { name: "Study Groups", href: "/dashboard/groups", icon: Users },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { user } = useUser()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <Sidebar className="h-screen border-r border-white/10 bg-[#0b1222]/95 backdrop-blur-xl" collapsible="icon" defaultOpen={!collapsed}>
      <SidebarContent>
        <SidebarHeader className="h-20 border-b border-white/10 px-4">
          <Logo href="/dashboard" />
        </SidebarHeader>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    className={cn(
                    "rounded-xl transition-all duration-200 hover:translate-x-1 hover:bg-white/10 hover:text-[#55D6FF]",
                    pathname === item.href && "bg-gradient-to-r from-[#7C5CFC]/20 to-[#55D6FF]/10 text-[#55D6FF] shadow-sm"
                    )}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarFooter className="border-t border-white/10 p-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <SignOutButton>
                  <button className="flex w-full items-center gap-2">
                    <LogOut className="h-5 w-5 text-slate-400" />
                    <span>Sign Out</span>
                  </button>
                </SignOutButton>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </SidebarContent>

      <div className="flex min-w-0 flex-1 flex-col bg-[#080d1c]">
        <header className="sticky top-0 z-40 flex h-20 items-center border-b border-white/10 bg-[#080d1c]/75 px-6 backdrop-blur-xl">
          <div className="flex-1">
            <p className="hidden text-xs font-medium uppercase tracking-[0.2em] text-slate-500 sm:block">Your adaptive learning space</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 md:flex">
              <span className="h-2 w-2 rounded-full bg-[#55D6FF]" />
              <span className="text-sm font-medium text-slate-300">{user?.firstName || "Learner"}</span>
            </div>
            <UserButton />
          </div>
        </header>
        <main className="dashboard-theme flex-1 overflow-auto bg-[radial-gradient(circle_at_80%_0%,rgba(124,92,252,.12),transparent_28rem)] p-4 sm:p-8">{children}</main>
      </div>
    </Sidebar>
  )
}