import { ThemedSignUp } from "@/components/auth/themed-auth"
import Link from "next/link"
export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-app flex flex-col">
      <header className="h-14 border-b border-border bg-card flex items-center px-4 sm:px-6 justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0"><div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">H</div><span className="font-bold text-sm whitespace-nowrap">HiPath AI</span></Link>
        <span className="hidden sm:block text-xs text-muted-foreground text-right">Create account → Onboarding → Roadmap</span>
      </header>
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 w-full">
        <div className="w-full max-w-md flex justify-center">
          <ThemedSignUp fallbackRedirectUrl="/auth/redirect" signInUrl="/sign-in" />
        </div>
      </main>
      <footer className="py-6 text-center text-xs text-muted-foreground">© 2026 HiPath AI — <a href="/privacy" className="underline">Privacy</a> • <a href="/terms" className="underline">Terms</a></footer>
    </div>
  )
}
