"use client"
import { SignIn, SignUp } from "@clerk/nextjs"
import { useTheme } from "next-themes"
import type { ComponentProps } from "react"

type SignInProps = ComponentProps<typeof SignIn>
type SignUpProps = ComponentProps<typeof SignUp>

/** Clerk auth cards themed to the active app theme (matrix gets green accents). */
export function ThemedSignIn(props: SignInProps) {
  const { resolvedTheme } = useTheme()
  return <SignIn appearance={authAppearance(resolvedTheme)} {...props} />
}

export function ThemedSignUp(props: SignUpProps) {
  const { resolvedTheme } = useTheme()
  return <SignUp appearance={authAppearance(resolvedTheme)} {...props} />
}

function authAppearance(resolvedTheme: string | undefined) {
  const base = { elements: { card: "shadow-sm border" } }
  if (resolvedTheme === "matrix") {
    return {
      ...base,
      variables: {
        colorBackground: "#000000",
        colorText: "#d6f5df",
        colorInputBackground: "#0a0f0b",
        colorInputText: "#d6f5df",
        colorPrimary: "#00E676",
      },
    }
  }
  if (resolvedTheme === "dark") {
    return {
      ...base,
      variables: {
        colorBackground: "#09090b",
        colorText: "#fafafa",
        colorInputBackground: "#18181b",
        colorInputText: "#fafafa",
        colorPrimary: "#6C5BFF",
      },
    }
  }
  return base
}
