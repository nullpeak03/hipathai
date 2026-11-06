import Link from "next/link"
import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { MarketingContainer, MarketingShell } from "@/components/marketing/marketing-shell"

export const metadata: Metadata = pageMetadata({
  title: "Refund & Cancellation Policy",
  description:
    "How HiPath Pro subscription cancellation, refunds, and billing support work.",
  path: "/refund",
})

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2">{children}</p>
    </section>
  )
}

export default function RefundPolicy() {
  return (
    <MarketingShell>
      <MarketingContainer width="prose">
        <h1 className="text-3xl font-bold">Refund &amp; Cancellation Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: October 26, 2026</p>
        <p className="mt-6 text-sm leading-relaxed">
          HiPath Pro is not currently available to purchase. This policy will apply when paid subscriptions launch.
          The subscription price and billing period will be shown before you confirm a purchase.
        </p>

        <div className="text-sm leading-relaxed">
          <Section title="First purchase refunds">
            You may request a refund within 7 calendar days of the first paid HiPath Pro subscription purchase on your account.
            When a refund is processed, your Pro access ends. Refunds are returned through the payment provider to the original payment method.
          </Section>
          <Section title="Renewal payments">
            Subscription renewal charges are not refundable, except where a refund is required by applicable law.
          </Section>
          <Section title="Canceling a subscription">
            You may cancel renewal at any time. Cancellation stops future renewals, and your Pro access continues through the end of the current paid period.
            Canceling does not by itself refund a payment.
          </Section>
          <Section title="How to request help">
            To request an eligible refund or get help with a cancellation, email{" "}
            <a href="mailto:support@hipathai.me" className="text-primary underline">support@hipathai.me</a>{" "}
            from your account email and include the transaction details shown on your receipt. Do not email full payment card details.
          </Section>
          <Section title="Legal rights">
            This policy does not limit any consumer rights that cannot be excluded under applicable law. Where local law provides stronger refund or cancellation rights, those rights apply.
          </Section>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          See also our <Link href="/terms" className="text-primary underline">Terms of Service</Link>,{" "}
          <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>, and{" "}
          <Link href="/contact" className="text-primary underline">Contact page</Link>.
        </p>
      </MarketingContainer>
    </MarketingShell>
  )
}
