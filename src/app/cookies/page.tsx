import Link from "next/link"
export const metadata = { title: "Cookie Policy — HiPath AI" }
export default function Cookies() {
  return (
    <div className="min-h-screen bg-white">
      <header className="h-14 border-b flex items-center px-6 max-w-4xl mx-auto w-full justify-between">
        <Link href="/" className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-[#6C5BFF] flex items-center justify-center text-white font-bold">H</div><span className="font-bold">HiPath AI</span></Link>
        <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900">Back to home</Link>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold">Cookie Policy</h1>
        <p className="text-sm text-zinc-500 mt-2">Last updated: Sep 2026</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed">
          <p>We use essential cookies only.</p>
          <h2 className="text-lg font-semibold">Essential</h2>
          <ul className="list-disc pl-5"><li>Clerk: session, auth (clerk.*)</li><li>Supabase: auth token</li><li>Preferences: theme, onboarding draft (localStorage)</li></ul>
          <h2 className="text-lg font-semibold">Analytics (optional)</h2>
          <p>PostHog (if enabled) for funnel — you can opt out via <Link href="/contact" className="text-[#6C5BFF] underline">Contact</Link>.</p>
          <h2 className="text-lg font-semibold">Manage</h2>
          <p>Control cookies in your browser. Blocking essential cookies will break sign-in.</p>
        </div>
      </main>
      <footer className="border-t py-6 text-center text-xs text-zinc-500">© 2026 HiPath AI</footer>
    </div>
  )
}
