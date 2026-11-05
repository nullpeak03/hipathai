import Link from "next/link"
import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"

export const metadata: Metadata = pageMetadata({
  title: "Cookie Policy",
  description:
    "Which cookies and browser storage HiPath AI uses, why they are needed, and how to manage analytics consent.",
  path: "/cookies",
})
export default function Cookies() {
  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b flex items-center px-6 max-w-4xl mx-auto w-full justify-between">
        <Link href="/" className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">H</div><span className="font-bold">HiPath AI</span></Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Back to home</Link>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold">Cookie Policy</h1>
        <p className="text-sm text-muted-foreground mt-2">Last updated: Oct 28, 2026</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed">
          <p>HiPath uses essential authentication cookies and browser storage for preferences and app data. Analytics is opt-in: if PostHog is configured for the deployment, it starts only after you choose Accept in the analytics banner. You can decline analytics and still use every feature.</p>
          <h2 className="text-lg font-semibold">Essential</h2>
          <ul className="list-disc pl-5"><li>Clerk: session, auth (clerk.*)</li><li>Supabase: auth token</li><li>Preferences: theme, onboarding draft (localStorage)</li></ul>
          <h2 className="text-lg font-semibold">Analytics (when configured)</h2>
          <p>PostHog records page views and selected product events to understand feature use. Pageview events omit query strings, and waitlist confirmation/removal pages containing bearer tokens are excluded. PostHog may use cookies or local storage depending on its configuration, and it only runs after you accept analytics.</p>
          <h2 className="text-lg font-semibold">Manage</h2>
          <p>You choose whether analytics runs the first time you visit. To change that choice later, clear this site&apos;s cookies and storage in your browser settings and reload the page. Clearing storage may sign you out or reset preferences; blocking essential cookies will break sign-in.</p>
        </div>
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">© 2026 HiPath AI</footer>
    </div>
  )
}
