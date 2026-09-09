import { SignUp } from "@clerk/nextjs";
import { Logo } from "@/components/Logo";
import Link from "next/link";

export default function SignUpPage() {
  const keyless = !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return (
    <div className="flex min-h-screen flex-col items-center bg-[#050A08] px-5 py-10 text-[#E6F4ED]">
      <Link href="/">
        <Logo />
      </Link>
      <p className="mt-4 font-mono text-xs text-[#8BA494]">
        &gt; new here — onboarding takes ~2 minutes
      </p>
      <div className="mt-6">
        {keyless ? (
          <div className="terminal-card max-w-sm p-5 text-sm text-[#8BA494]">
            Auth keys missing on this preview. Add Clerk keys to enable sign-up.
            <Link href="/onboarding" className="mt-4 block rounded-lg bg-[#10B981] px-4 py-2.5 text-center font-semibold text-[#050A08]">
              Continue to Onboarding (preview)
            </Link>
          </div>
        ) : (
          <SignUp
            appearance={{
              variables: { colorPrimary: "#10B981", colorBackground: "#0A120E" },
            }}
            forceRedirectUrl="/onboarding"
            signInForceRedirectUrl="/onboarding"
          />
        )}
      </div>
    </div>
  );
}
