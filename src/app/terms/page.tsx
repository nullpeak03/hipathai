import Link from "next/link"
import { Logo } from "@/components/brand/logo"

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <Logo href="/" />
        <div>
          <p className="text-sm font-medium text-primary">Legal</p>
          <h1 className="mt-2 text-4xl font-bold">Terms of Service</h1>
          <p className="mt-3 text-muted-foreground">Effective: September 5, 2026</p>
        </div>
        <div className="space-y-6 text-muted-foreground">
          <p>HiPath AI provides adaptive learning tools for education and professional development. AI-generated content is guidance and should be reviewed before use in high-stakes decisions.</p>
          <p>Use the service responsibly, protect your account, and do not submit confidential information to AI features. We may improve or retire features while preserving your exported data.</p>
        </div>
        <Link className="text-primary underline" href="/">Return to HiPath AI</Link>
      </div>
    </main>
  )
}
