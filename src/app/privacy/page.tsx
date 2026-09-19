import Link from "next/link"
export const metadata = { title: "Privacy Policy — HiPath AI" }
export default function Privacy() {
  return (
    <div className="min-h-screen bg-white">
      <header className="h-14 border-b flex items-center px-6 max-w-4xl mx-auto w-full justify-between">
        <Link href="/" className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-[#6C5BFF] flex items-center justify-center text-white font-bold">H</div><span className="font-bold">HiPath AI</span></Link>
        <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900">Back to home</Link>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="text-sm text-zinc-500 mt-2">Last updated: Sep 2026</p>
        <div className="prose max-w-none mt-8 space-y-6 text-sm leading-relaxed">
          <p>HiPath AI respects your privacy. We collect only what we need to provide your learning journey: account info via Clerk (email, name, avatar), roadmaps, lessons, progress, and chat messages stored in Supabase.</p>
          <h2 className="text-lg font-semibold mt-6">Data we collect</h2>
          <ul className="list-disc pl-5 space-y-1"><li>Clerk ID, email, name, avatar</li><li>Onboarding answers (goal, level, time, etc.)</li><li>Roadmaps, phases, lessons, quiz attempts, progress</li><li>Tutor messages (for persistent memory)</li><li>Gamification (XP, streak, level)</li></ul>
          <h2 className="text-lg font-semibold">How we use it</h2>
          <p>To generate adaptive roadmaps via our AI provider (Gemini), personalize lessons, and keep your mentor context-aware. We do not sell data.</p>
          <h2 className="text-lg font-semibold">Storage</h2>
          <p>Supabase (EU/US) with RLS. Data is tied to your Clerk ID. You can request export or deletion via <Link href="/contact" className="text-[#6C5BFF] underline">Contact</Link>.</p>
          <h2 className="text-lg font-semibold">Cookies</h2>
          <p>Essential cookies for auth (Clerk) and preferences. See <Link href="/cookies" className="text-[#6C5BFF] underline">Cookie Policy</Link>.</p>
          <h2 className="text-lg font-semibold">Contact</h2>
          <p>Questions? <Link href="/contact" className="text-[#6C5BFF] underline">Contact us</Link> or email privacy@hipathai.me.</p>
        </div>
      </main>
      <footer className="border-t py-6 text-center text-xs text-zinc-500">© 2026 HiPath AI — <Link href="/terms" className="underline">Terms</Link> • <Link href="/cookies" className="underline">Cookies</Link></footer>
    </div>
  )
}
