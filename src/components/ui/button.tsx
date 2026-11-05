"use client"
import * as React from "react"
import { motion } from "framer-motion"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
const buttonVariants = cva("inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:pointer-events-none", {
  variants: {
    variant: { default: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm", outline: "border border-border bg-card hover:bg-muted", ghost: "hover:bg-muted", secondary: "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" },
    size: { default: "h-10 px-6 py-2", sm: "h-8 px-3", lg: "h-12 px-8", icon: "h-9 w-9" }
  },
  defaultVariants: { variant: "default", size: "default" }
})
export interface ButtonProps
  extends
    Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationComplete"
    >,
    VariantProps<typeof buttonVariants> {
  /**
   * Render the single child (usually a next/link `<Link>`) with button styles
   * instead of nesting a `<button>` inside an `<a>`. Nested interactive
   * elements are invalid HTML and fail accessibility checks.
   */
  asChild?: boolean
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, children, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size }), className)

    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement<{ className?: string }>
      return React.cloneElement(child, {
        className: cn(classes, child.props.className),
      })
    }

    return <motion.button ref={ref} whileTap={{ scale: 0.97 }} className={classes} {...props} />
  }
)
Button.displayName = "Button"
