import { SignIn } from "@clerk/nextjs"
export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-14 border-b bg-white flex items-center px-6 justify-between">
        <a href="/" className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-[#6C5BFF] flex items-center justify-center text-white font-bold">H</div><span className="font-bold text-sm">HiPath AI</span></a>
        <span className="text-xs text-zinc-500">Sign in to continue → Onboarding → Roadmap</span>
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        <SignIn appearance={{ elements: { card: "shadow-sm border" } }} fallbackRedirectUrl="/onboarding" signUpUrl="/sign-up" />
      </main>
      <footer className="py-6 text-center text-xs text-zinc-500">© 2026 HiPath AI — <a href="/privacy" className="underline">Privacy</a> • <a href="/terms" className="underline">Terms</a></footer>
    </div>
  )
}
