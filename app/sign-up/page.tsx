import { SignUp, ClerkLoaded, ClerkLoading } from "@clerk/nextjs";
import { Logo } from "@/components/Logo";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getActiveRoadmapId } from "@/lib/hasRoadmap";

export const metadata = {
  title: "Sign up | HiPath AI",
  description: "Create a personalized roadmap in minutes — lessons, quizzes, Socratic tutor.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://www.hipathai.me/sign-up" },
};

export default async function SignUpPage() {
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
      <h1 className="sr-only">Sign up for HiPath AI</h1>
      <Link href="/" aria-label="HiPath AI home">
        <Logo />
      </Link>
      <p className="mt-4 font-mono text-xs text-[#8BA494]">&gt; new here — onboarding takes ~2 minutes</p>
      <div className="mt-6 w-full max-w-sm">
        {keyless ? (
          <div className="terminal-card p-5 text-sm text-[#8BA494]">
            Auth keys missing on this preview. Add Clerk keys to enable sign-up.
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
                <SignUp
                  appearance={{
                    variables: { colorPrimary: "#10B981", colorBackground: "#0A120E" },
                    elements: {
                      formFieldError: "text-[#F87171] text-xs",
                      formButtonPrimary: "bg-[#10B981] hover:bg-[#34D399] text-[#050A08]",
                    },
                  }}
                  forceRedirectUrl="/onboarding"
                  signInForceRedirectUrl="/onboarding"
                />
              </div>
            </ClerkLoaded>
            <p className="mt-4 text-center font-mono text-xs text-[#8BA494]">
              By signing up you agree to <Link href="/privacy" className="underline hover:text-[#E6F4ED]">Privacy</Link> & <Link href="/terms" className="underline hover:text-[#E6F4ED]">Terms</Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
