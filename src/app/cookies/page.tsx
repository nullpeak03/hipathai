import type { Metadata } from "next"
import { pageMetadata } from "@/lib/metadata"
import { MarketingContainer, MarketingShell } from "@/components/marketing/marketing-shell"

export const metadata: Metadata = pageMetadata({
  title: "Cookie Policy",
  description:
    "Which cookies and browser storage HiPath AI uses, why they are needed, and how to manage analytics consent.",
  path: "/cookies",
})
export default function Cookies() {
  return (
    <MarketingShell>
      <MarketingContainer width="prose">
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
      </MarketingContainer>
    </MarketingShell>
  )
}
