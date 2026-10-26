import type { Metadata } from "next"
import Link from "next/link"
import { WaitlistTokenAction } from "@/components/pricing/pricing-waitlist-form"

export const metadata: Metadata = {
  title: "Confirm Pro launch notification",
  robots: { index: false, follow: false },
}

export default async function ConfirmPricingWaitlist({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-background px-5 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-7 shadow-sm sm:p-9">
        <Link href="/" className="text-sm font-semibold text-primary">HiPath AI</Link>
        <h1 className="mt-5 text-2xl font-bold">Confirm your email</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Confirm that you want one email when HiPath Pro launches. This won’t subscribe you to other marketing.
        </p>
        <WaitlistTokenAction token={token} action="confirm" />
        <p className="mt-6 text-xs text-muted-foreground"><Link href="/privacy" className="underline">Privacy policy</Link></p>
      </section>
    </main>
  )
}
