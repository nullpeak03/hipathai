"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
  Brain,
  MessageSquare,
  BarChart3,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
  User,
} from "lucide-react"
import { useUser } from "@clerk/nextjs"
import { SignOutButton } from "@clerk/nextjs"

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
    <Sidebar className="h-screen border-r" collapsible="icon" defaultOpen={!collapsed}>
      <SidebarContent>
        <SidebarHeader className="h-16 px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">HiPath AI</span>
          </Link>
        </SidebarHeader>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    className={cn(
                      "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
                      pathname === item.href && "bg-accent text-accent-foreground"
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
        <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 flex items-center px-4">
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
              <span className="text-sm font-medium">{user?.firstName || "User"}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </Sidebar>
  )
}