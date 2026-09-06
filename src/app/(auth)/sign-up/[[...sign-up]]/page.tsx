import { SignUp } from "@clerk/nextjs"
import Link from "next/link"
import { Logo } from "@/components/brand/logo"

export default function SignUpPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080d1c] px-4 py-8 text-white sm:px-8">
      <div className="absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-[#55D6FF]/15 blur-3xl" />
      <div className="absolute -right-24 top-16 h-96 w-96 rounded-full bg-[#7C5CFC]/25 blur-3xl" />
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-14 lg:grid-cols-[1fr_0.8fr]">
        <div className="hidden lg:block">
          <Logo href="/" className="mb-20 text-white" />
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.25em] text-[#55D6FF]">Start your next chapter</p>
          <h1 className="max-w-lg text-6xl font-semibold leading-[1.05]">Turn curiosity into a clear path forward.</h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-slate-400">Tell us where you want to go. HiPath AI will build the route and adapt it as you learn.</p>
        </div>
        <div className="w-full max-w-md justify-self-center">
          <div className="mb-8 lg:hidden"><Logo href="/" className="text-white" /></div>
          <div className="mb-6">
            <h2 className="text-3xl font-semibold">Create your account</h2>
            <p className="mt-2 text-slate-400">Start your personalized learning journey for free.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8">
          <SignUp
            appearance={{
              elements: {
                formButtonPrimary: "bg-gradient-to-r from-[#7C5CFC] to-[#55D6FF] hover:opacity-90 text-[#080d1c] font-semibold",
                card: "shadow-none border-0 bg-transparent",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton: "border-white/10 bg-white/5 text-white hover:bg-white/10",
                formFieldLabel: "text-slate-300",
                formFieldInput: "border-white/10 bg-white/10 text-white",
                footerActionLink: "text-[#55D6FF]",
              },
            }}
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            forceRedirectUrl="/onboarding"
          />
          </div>
          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-[#55D6FF] hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  )
}