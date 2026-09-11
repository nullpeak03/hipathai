export const metadata = { title: "Privacy Policy | HiPath AI", description: "Privacy Policy for HiPath AI — how we collect, use, and protect your data." };
export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#050A08] px-5 py-14 text-[#E6F4ED]">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-xs text-[#10B981]">LEGAL · PRIVACY</p>
        <h1 className="font-display mt-2 text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 font-mono text-xs text-[#8BA494]">Last updated: September 11, 2026</p>
        <div className="terminal-card mt-6 space-y-6 p-6 text-sm leading-relaxed text-[#8BA494]">
          <p>HiPath AI respects your privacy. This policy explains what we collect, how we use it, and how we protect it.</p>
          <section>
            <h2 className="font-display font-semibold text-[#E6F4ED]">1. Information we collect</h2>
            <p className="mt-2">Account data via Clerk (email, username, OAuth profile), learning data (goals, progress, quiz scores), and technical data (device, logs). We do not sell your data.</p>
          </section>
          <section>
            <h2 className="font-display font-semibold text-[#E6F4ED]">2. How we use it</h2>
            <p className="mt-2">To generate personalized roadmaps, adapt difficulty, provide Socratic tutoring, and improve the service. AI calls are logged anonymously for quality.</p>
          </section>
          <section>
            <h2 className="font-display font-semibold text-[#E6F4ED]">3. Storage</h2>
            <p className="mt-2">Data is stored in Supabase (Postgres, EU) with Row Level Security. Auth tokens are managed by Clerk.</p>
          </section>
          <section>
            <h2 className="font-display font-semibold text-[#E6F4ED]">4. Your rights</h2>
            <p className="mt-2">You can export or delete your data via Settings → Export / Delete Account, or contact hello@hipathai.me.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
