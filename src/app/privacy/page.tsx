import Link from "next/link"
import { Logo } from "@/components/brand/logo"

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <Logo href="/" />
        <div>
          <p className="text-sm font-medium text-primary">Legal</p>
          <h1 className="mt-2 text-4xl font-bold">Privacy Policy</h1>
          <p className="mt-3 text-muted-foreground">Last updated: September 5, 2026</p>
        </div>
        <div className="space-y-6 text-muted-foreground">
          <p>HiPath AI stores the learning information needed to personalize roadmaps, quizzes, lessons, and analytics. We do not sell personal data.</p>
          <p>Authentication is handled by Clerk and learning data is stored in Supabase. AI requests are sent to the configured NVIDIA provider only to deliver requested learning features.</p>
          <p>You can request data export or account deletion from Settings or by emailing <a className="text-primary underline" href="mailto:privacy@hipathai.me">privacy@hipathai.me</a>.</p>
        </div>
        <Link className="text-primary underline" href="/">Return to HiPath AI</Link>
      </div>
    </main>
  )
}
