import { ThemedSignUp } from "@/components/auth/themed-auth"
import Link from "next/link"
export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-app flex flex-col">
      <header className="h-14 border-b border-border bg-card flex items-center px-6 justify-between">
        <Link href="/" className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">H</div><span className="font-bold text-sm">HiPath AI</span></Link>
        <span className="text-xs text-muted-foreground">Create account → Onboarding → Roadmap</span>
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        <ThemedSignUp fallbackRedirectUrl="/onboarding" signInUrl="/sign-in" />
      </main>
      <footer className="py-6 text-center text-xs text-muted-foreground">© 2026 HiPath AI — <a href="/privacy" className="underline">Privacy</a> • <a href="/terms" className="underline">Terms</a></footer>
    </div>
  )
}
