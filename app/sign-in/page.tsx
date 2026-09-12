import { SignIn, ClerkLoaded, ClerkLoading } from "@clerk/nextjs";
import { Logo } from "@/components/Logo";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getActiveRoadmapId } from "@/lib/hasRoadmap";

export const metadata = {
  title: "Sign in | HiPath AI",
  description: "Sign in to continue your adaptive learning roadmap — lessons, quizzes, Socratic tutor.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://www.hipathai.me/sign-in" },
};

export default async function SignInPage() {
  const keyless = !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!keyless) {
    const { userId } = await auth();
    if (userId) {
      const id = await getActiveRoadmapId(userId);
      redirect(id ? "/app/dashboard" : "/onboarding");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#050A08] px-5 py-10 text-[#E6F4ED]">
      <h1 className="sr-only">Sign in to HiPath AI</h1>
      <Link href="/" aria-label="HiPath AI home">
        <Logo />
      </Link>
      <p className="mt-4 font-mono text-xs text-[#8BA494]">&gt; sign in to continue your path</p>
      <div className="mt-6 w-full max-w-sm">
        {keyless ? (
          <div className="terminal-card p-5 text-sm text-[#8BA494]">
            Auth keys missing on this preview. Add
            <span className="font-mono text-[#E6F4ED]"> NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY </span>+
            <span className="font-mono text-[#E6F4ED]"> CLERK_SECRET_KEY </span> to enable sign-in.
            <Link href="/onboarding" className="mt-4 block rounded-lg bg-[#10B981] px-4 py-2.5 text-center font-semibold text-[#050A08]">
              Continue to Onboarding (preview)
            </Link>
          </div>
        ) : (
          <>
            <ClerkLoading>
              <div className="terminal-card max-w-sm animate-pulse space-y-3 p-5">
                <div className="h-10 rounded bg-[#0A120E]" />
                <div className="h-10 rounded bg-[#0A120E]" />
                <div className="h-10 rounded bg-[#10B98122]" />
              </div>
            </ClerkLoading>
            <ClerkLoaded>
              <div className="animate-[fadeIn_0.4s_ease]">
                <SignIn
                  appearance={{
                    variables: { colorPrimary: "#10B981", colorBackground: "#0A120E" },
                    elements: {
                      formFieldError: "text-[#F87171] text-xs",
                      formButtonPrimary: "bg-[#10B981] hover:bg-[#34D399] text-[#050A08]",
                    },
                  }}
                  forceRedirectUrl="https://www.hipathai.me/onboarding"
                  signUpForceRedirectUrl="https://www.hipathai.me/onboarding"
                  fallbackRedirectUrl="https://www.hipathai.me/onboarding"
                  signUpFallbackRedirectUrl="https://www.hipathai.me/onboarding"
                />
              </div>
            </ClerkLoaded>
            <p className="mt-4 text-center font-mono text-xs text-[#8BA494]">
              By signing in you agree to <Link href="/privacy" className="underline hover:text-[#E6F4ED]">Privacy</Link> & <Link href="/terms" className="underline hover:text-[#E6F4ED]">Terms</Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
