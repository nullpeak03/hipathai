"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    collapsible?: "icon" | "none"
    defaultOpen?: boolean
  }
>(({ className, collapsible = "none", defaultOpen = true, children, ...props }, ref) => {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <div
      ref={ref}
      className={cn(
        "group flex min-h-svg flex-col bg-sidebar text-sidebar-foreground",
        collapsible === "icon" &&
          "data-[collapsible=icon]:w-20 data-[collapsible=icon]:w-[calc(var(--sidebar-width)+var(--sidebar-width-icon))]",
        className
      )}
      data-collapsible={collapsible}
      data-state={open ? "open" : "closed"}
      {...props}
    >
      {children}
      <SidebarTrigger />
    </div>
  )
})
Sidebar.displayName = "Sidebar"

const SidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { "data-state"?: string }
>(({ className, onClick, "data-state": dataState, ...props }, ref) => (
  <button
    ref={ref}
    onClick={onClick}
    className={cn(
      "absolute right-0 top-0 z-50 h-12 w-12 transition-all",
      "hover:bg-accent hover:text-accent-foreground",
      "data-[state=open]:rotate-180",
      "data-[collapsible=icon]:-right-3",
      className
    )}
    data-state={dataState}
    {...props}
  >
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 19l-7-7 7-7"
      />
    </svg>
  </button>
))
SidebarTrigger.displayName = "SidebarTrigger"

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col overflow-y-auto", className)}
    {...props}
  />
))
SidebarContent.displayName = "SidebarContent"

const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("relative flex flex-col", className)} {...props} />
))
SidebarGroup.displayName = "SidebarGroup"

const SidebarGroupContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col", className)} {...props} />
))
SidebarGroupContent.displayName = "SidebarGroupContent"

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-2 px-4", className)}
    {...props}
  />
))
SidebarHeader.displayName = "SidebarHeader"

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-2 px-4", className)}
    {...props}
  />
))
SidebarFooter.displayName = "SidebarFooter"

const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-col gap-1", className)}
    {...props}
  />
))
SidebarMenu.displayName = "SidebarMenu"

const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("", className)} {...props} />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

const sidebarMenuButtonVariants = cva(
  "flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-has-[[data-collapsible=icon]]:pr-2 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:h-0 group-data-[collapsible=icon]:overflow-hidden group-data-[side=left]:rounded-r-lg group-data-[side=right]:rounded-l-lg data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
  {
    variants: {
      variant: {
        default: "",
        outline:
          "bg-transparent shadow-[inset_0_-1px_0_hsl(var(--border))] hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10",
        sm: "h-9",
        lg: "h-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: VariantProps<typeof sidebarMenuButtonVariants>["variant"]
    size?: VariantProps<typeof sidebarMenuButtonVariants>["size"]
    asChild?: boolean
  }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      ref={ref}
      className={cn(sidebarMenuButtonVariants({ variant, size, className }))}
      {...props}
    />
  )
})
SidebarMenuButton.displayName = "SidebarMenuButton"

export {
  Sidebar,
  SidebarTrigger,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
}