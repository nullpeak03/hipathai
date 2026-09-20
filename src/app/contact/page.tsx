import Link from "next/link"
export const metadata = { title: "Contact — HiPath AI" }
export default function Contact() {
  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b flex items-center px-6 max-w-4xl mx-auto w-full justify-between">
        <Link href="/" className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">H</div><span className="font-bold">HiPath AI</span></Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Back to home</Link>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
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
              <a href="https://github.com/nullpeak03/hipathai" target="_blank" className="text-primary underline">GitHub</a>
            </div>
          </div>
          <p className="text-xs text-zinc-400">Response within 2 business days. V1 is community-supported.</p>
        </div>
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">© 2026 HiPath AI</footer>
    </div>
  )
}
