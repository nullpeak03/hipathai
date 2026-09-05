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
    <Sidebar className="h-screen border-r bg-background/90 backdrop-blur" collapsible="icon" defaultOpen={!collapsed}>
      <SidebarContent>
        <SidebarHeader className="h-16 px-4">
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
                    "transition-all duration-200 hover:translate-x-1 hover:bg-primary/10 hover:text-primary",
                    pathname === item.href && "bg-primary/10 text-primary shadow-sm"
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

        <SidebarFooter className="p-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <SignOutButton>
                  <button className="flex w-full items-center gap-2">
                    <LogOut className="h-5 w-5" />
                    <span>Sign Out</span>
                  </button>
                </SignOutButton>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </SidebarContent>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-background/75 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 flex items-center px-4">
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
              <span className="text-sm font-medium">{user?.firstName || "User"}</span>
            </div>
            <UserButton />
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </Sidebar>
  )
}