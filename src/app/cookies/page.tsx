import Link from "next/link"
export const metadata = { title: "Cookie Policy — HiPath AI" }
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
          <p>HiPath uses essential authentication cookies and may use browser storage for preferences and app data. If PostHog is configured for the deployment, analytics is active by default without an in-app consent prompt.</p>
          <h2 className="text-lg font-semibold">Essential</h2>
          <ul className="list-disc pl-5"><li>Clerk: session, auth (clerk.*)</li><li>Supabase: auth token</li><li>Preferences: theme, onboarding draft (localStorage)</li></ul>
          <h2 className="text-lg font-semibold">Analytics (when configured)</h2>
          <p>PostHog records page views and selected product events to understand feature use. Pageview events omit query strings, and waitlist confirmation/removal pages containing bearer tokens are excluded. PostHog may use cookies or local storage depending on its configuration. There is currently no in-app analytics opt-out control.</p>
          <h2 className="text-lg font-semibold">Manage</h2>
          <p>You can manage or clear browser cookies and storage in your browser settings; doing so may sign you out or reset preferences. Blocking essential cookies will break sign-in.</p>
        </div>
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">© 2026 HiPath AI</footer>
    </div>
  )
}
