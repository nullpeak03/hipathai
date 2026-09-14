"use client"
export function Providers({ children }: { children: React.ReactNode }) {
  // Light only — no ThemeProvider, forced light
  return <>{children}</>
}
