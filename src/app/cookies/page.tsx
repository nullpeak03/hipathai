import Link from "next/link"
import { Logo } from "@/components/brand/logo"

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-[#080d1c] px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl space-y-8 rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-12">
        <Logo href="/" />
        <div>
          <p className="text-sm font-medium text-[#55D6FF]">Legal</p>
          <h1 className="mt-2 text-4xl font-bold">Cookie Policy</h1>
          <p className="mt-3 text-slate-400">Updated: September 5, 2026</p>
        </div>
        <div className="space-y-6 leading-8 text-slate-300">
          <p>HiPath AI uses essential cookies for authentication, security, theme preferences, and session continuity.</p>
          <p>We do not use advertising cookies. Optional analytics should only be enabled where disclosed and permitted by your browser or workspace settings.</p>
        </div>
        <Link className="text-[#55D6FF] underline" href="/">Return to HiPath AI</Link>
      </div>
    </main>
  )
}
