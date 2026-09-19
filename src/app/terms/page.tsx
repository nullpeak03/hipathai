import Link from "next/link"
export const metadata = { title: "Terms of Service — HiPath AI" }
export default function Terms() {
  return (
    <div className="min-h-screen bg-white">
      <header className="h-14 border-b flex items-center px-6 max-w-4xl mx-auto w-full justify-between">
        <Link href="/" className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-[#6C5BFF] flex items-center justify-center text-white font-bold">H</div><span className="font-bold">HiPath AI</span></Link>
        <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900">Back to home</Link>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <p className="text-sm text-zinc-500 mt-2">Last updated: Sep 2026</p>
        <div className="prose max-w-none mt-8 space-y-6 text-sm leading-relaxed">
          <p>By using HiPath AI, you agree to these terms. HiPath AI is an AI-powered learning navigator for CS & Technology, currently free for V1.</p>
          <h2 className="text-lg font-semibold">Use</h2>
          <p>Provide accurate onboarding info. Do not abuse AI APIs (rate-limited). Content is AI-generated — verify critical info.</p>
          <h2 className="text-lg font-semibold">Accounts</h2>
          <p>Auth via Clerk (Google/GitHub/Email). You are responsible for your account. We may suspend abusive accounts.</p>
          <h2 className="text-lg font-semibold">Content</h2>
          <p>Roadmaps/lessons are generated via Gemini AI with automatic retries. We aim for accuracy but do not guarantee. Report errors via <Link href="/contact" className="text-[#6C5BFF] underline">Contact</Link>.</p>
          <h2 className="text-lg font-semibold">Free tier</h2>
          <p>V1 is free. Future paid tiers may have limits — you’ll be notified.</p>
          <h2 className="text-lg font-semibold">Liability</h2>
          <p>HiPath AI is provided “as is” without warranties. We are not liable for learning outcomes.</p>
        </div>
      </main>
      <footer className="border-t py-6 text-center text-xs text-zinc-500">© 2026 HiPath AI — <Link href="/privacy" className="underline">Privacy</Link></footer>
    </div>
  )
}
