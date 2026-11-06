import Link from "next/link"
import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { MarketingContainer, MarketingShell } from "@/components/marketing/marketing-shell"

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description:
    "Contact the HiPath AI team for support, privacy and data requests, account deletion, or partnership questions.",
  path: "/contact",
})
export default function Contact() {
  return (
    <MarketingShell>
      <MarketingContainer width="prose">
        <h1 className="text-3xl font-bold">Contact</h1>
        <p className="text-sm text-muted-foreground mt-2">We’d love to hear from you.</p>
        <div className="mt-8 space-y-6">
          <div className="border border-border rounded-xl p-6 bg-muted">
            <h2 className="font-semibold">Email</h2>
            <p className="text-sm text-muted-foreground mt-1">support@hipathai.me • privacy@hipathai.me</p>
            <p className="text-xs text-muted-foreground mt-2">For data export/deletion, include your Clerk email.</p>
          </div>
          <div className="border rounded-xl p-6">
            <h2 className="font-semibold">Links</h2>
            <div className="flex flex-wrap gap-3 mt-3 text-sm">
              <Link href="/privacy" className="text-primary underline">Privacy</Link>
              <Link href="/terms" className="text-primary underline">Terms</Link>
              <Link href="/cookies" className="text-primary underline">Cookies</Link>
              <Link href="/refund" className="text-primary underline">Refunds & cancellations</Link>
              <a href="https://github.com/nullpeak03/hipathai" target="_blank" className="text-primary underline">GitHub</a>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Response within 2 business days. HiPath AI is community-supported.</p>
        </div>
      </MarketingContainer>
    </MarketingShell>
  )
}
