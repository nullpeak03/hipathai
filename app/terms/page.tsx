export const metadata = { title: "Terms of Service | HiPath AI", description: "Terms of Service for HiPath AI." };
export default function Terms() {
  return (
    <div className="min-h-screen bg-[#050A08] px-5 py-14 text-[#E6F4ED]">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-xs text-[#10B981]">LEGAL · TERMS</p>
        <h1 className="font-display mt-2 text-3xl font-bold">Terms of Service</h1>
        <p className="mt-2 font-mono text-xs text-[#8BA494]">Last updated: September 11, 2026</p>
        <div className="terminal-card mt-6 space-y-6 p-6 text-sm leading-relaxed text-[#8BA494]">
          <section>
            <h2 className="font-display font-semibold text-[#E6F4ED]">1. Acceptance</h2>
            <p className="mt-2">By using HiPath AI you agree to these terms and to our Privacy Policy.</p>
          </section>
          <section>
            <h2 className="font-display font-semibold text-[#E6F4ED]">2. Fair use</h2>
            <p className="mt-2">AI is capped (20 calls/day, 5 roadmaps/week). Do not abuse, scrape, or reverse-engineer the service.</p>
          </section>
          <section>
            <h2 className="font-display font-semibold text-[#E6F4ED]">3. Content</h2>
            <p className="mt-2">Lessons and quizzes are AI-generated. Verify critical information independently. Your GitHub submissions remain yours.</p>
          </section>
          <section>
            <h2 className="font-display font-semibold text-[#E6F4ED]">4. Liability</h2>
            <p className="mt-2">Service is provided “as is” without warranties. Contact hello@hipathai.me for questions.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
