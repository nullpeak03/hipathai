import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
const buttonVariants = cva("inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none", {
  variants: {
    variant: { default: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm", outline: "border border-border bg-card hover:bg-muted", ghost: "hover:bg-muted", secondary: "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" },
    size: { default: "h-10 px-6 py-2", sm: "h-8 px-3", lg: "h-12 px-8", icon: "h-9 w-9" }
  },
  defaultVariants: { variant: "default", size: "default" }
})
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
))
Button.displayName = "Button"
