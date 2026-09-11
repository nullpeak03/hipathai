export const metadata = { title: "Cookie Policy | HiPath AI", description: "Cookie Policy for HiPath AI." };
export default function Cookies() {
  return (
    <div className="min-h-screen bg-[#050A08] px-5 py-14 text-[#E6F4ED]">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-xs text-[#10B981]">LEGAL · COOKIES</p>
        <h1 className="font-display mt-2 text-3xl font-bold">Cookie Policy</h1>
        <p className="mt-2 font-mono text-xs text-[#8BA494]">Last updated: September 11, 2026</p>
        <div className="terminal-card mt-6 space-y-6 p-6 text-sm leading-relaxed text-[#8BA494]">
          <section>
            <h2 className="font-display font-semibold text-[#E6F4ED]">1. What are cookies?</h2>
            <p className="mt-2">Small text files stored on your device to keep you signed in and remember preferences.</p>
          </section>
          <section>
            <h2 className="font-display font-semibold text-[#E6F4ED]">2. How we use them</h2>
            <p className="mt-2"><span className="text-[#E6F4ED]">Essential:</span> Clerk auth, Supabase session, PWA offline cache. No advertising or tracking cookies in v1.</p>
          </section>
          <section>
            <h2 className="font-display font-semibold text-[#E6F4ED]">3. Your choices</h2>
            <p className="mt-2">You can block cookies in your browser, but sign-in and offline lessons will not work. Manage via Settings → Privacy.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
