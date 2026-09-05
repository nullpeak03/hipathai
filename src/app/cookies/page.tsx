import Link from "next/link"
import { Logo } from "@/components/brand/logo"

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <Logo href="/" />
        <div>
          <p className="text-sm font-medium text-primary">Legal</p>
          <h1 className="mt-2 text-4xl font-bold">Cookie Policy</h1>
          <p className="mt-3 text-muted-foreground">Updated: September 5, 2026</p>
        </div>
        <div className="space-y-6 text-muted-foreground">
          <p>HiPath AI uses essential cookies for authentication, security, theme preferences, and session continuity.</p>
          <p>We do not use advertising cookies. Optional analytics should only be enabled where disclosed and permitted by your browser or workspace settings.</p>
        </div>
        <Link className="text-primary underline" href="/">Return to HiPath AI</Link>
      </div>
    </main>
  )
}
