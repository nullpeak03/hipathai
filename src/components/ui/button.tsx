import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
const buttonVariants = cva("inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none", {
  variants: {
    variant: { default: "bg-[#6C5BFF] text-white hover:bg-[#5a4ae0] shadow-sm", outline: "border border-gray-200 bg-white hover:bg-gray-50", ghost: "hover:bg-gray-100", secondary: "bg-gray-900 text-white" },
    size: { default: "h-10 px-6 py-2", sm: "h-8 px-3", lg: "h-12 px-8", icon: "h-9 w-9" }
  },
  defaultVariants: { variant: "default", size: "default" }
})
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
))
Button.displayName = "Button"
