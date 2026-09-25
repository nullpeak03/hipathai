import Link from "next/link"
export const metadata = { title: "Privacy Policy — HiPath AI" }

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold mt-8">{children}</h2>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-2">{children}</p>
}

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b flex items-center px-6 max-w-4xl mx-auto w-full justify-between">
        <Link href="/" className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">H</div><span className="font-bold">HiPath AI</span></Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Back to home</Link>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mt-2">Last updated: September 25, 2026</p>
        <div className="prose max-w-none mt-8 text-sm leading-relaxed">
          <P>
            HiPath AI (&ldquo;we&rdquo;, &ldquo;our&rdquo;) is a personalized AI learning platform at{" "}
            <Link href="/" className="text-primary underline">hipathai.me</Link>. This policy explains what
            personal data we collect when you use HiPath AI, why we collect it, who we share it with,
            how long we keep it, and the choices you have. If you do not agree with this policy,
            please do not use the service.
          </P>

          <H>1. Data we collect</H>
          <P><strong>Account data (via Clerk, our auth provider).</strong> When you sign up or sign in — including with Google Sign-In — we receive your Clerk user ID, name, email address, and profile picture. Google Sign-In shares only your basic profile (name, email, avatar) under standard OpenID scopes; we use it solely to create and secure your account, never for advertising.</P>
          <P><strong>Learning profile.</strong> Your onboarding answers: learning goal, current level, daily study time, schedule duration, motivation, and learning-style preferences.</P>
          <P><strong>Learning content and activity.</strong> Your generated roadmaps, phases, and lessons; lesson content; quiz questions, your answers, scores, and attempts; study progress and completion state; weak topics detected from quiz performance; spaced-repetition review schedule; daily study activity and minutes studied; gamification state (XP, level, streaks).</P>
          <P><strong>Tutor conversations.</strong> Messages you send to the AI tutor and its replies, stored so your mentor remembers context across sessions.</P>
          <P><strong>Preferences and support.</strong> Notification and appearance settings, account-deletion and data-export requests, and messages you send via the <Link href="/contact" className="text-primary underline">contact page</Link>.</P>
          <P><strong>Technical data.</strong> Authentication session cookies (Clerk), theme preference, on-device cache of your roadmap and drafts (browser localStorage), and standard server logs (IP address, pages visited, timestamps) used for security and debugging. When enabled, privacy-friendly product analytics (page views, feature funnels) help us improve the app.</P>
          <P>We do not collect payment data (the service is free), precise location, contacts, or biometric data.</P>

          <H>2. How we use your data</H>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Operate your account:</strong> sign-in, session security, and identifying your data.</li>
            <li><strong>Generate your learning:</strong> roadmaps, lesson content, quizzes, and tutor replies are produced by our AI provider from your goal, level, and lesson content — never from your password or payment details (we hold neither).</li>
            <li><strong>Personalize and adapt:</strong> weakness detection, spaced reviews, difficulty adaptation, and streak reminders use your activity history.</li>
            <li><strong>Communicate:</strong> at most one streak-reminder email per day when enabled (opt out anytime in Settings).</li>
            <li><strong>Improve and secure:</strong> aggregated analytics, error logs, and abuse prevention.</li>
          </ul>
          <P>We do not sell your personal data and do not use it for third-party advertising.</P>

          <H>3. Who we share data with (subprocessors)</H>
          <P>We share data only as needed to run the service, under contracts that limit use to our instructions:</P>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Clerk</strong> — authentication and account data.</li>
            <li><strong>Supabase</strong> — secure cloud database storing your account, learning data, and chats (row-level security; server-only service access).</li>
            <li><strong>NVIDIA (AI models)</strong> — receives learning prompts (goals, lesson topics, quiz content) to generate roadmaps, lessons, quizzes, and tutor replies.</li>
            <li><strong>Inngest</strong> — background job processing for generation and reminders.</li>
            <li><strong>Vercel</strong> — hosting and delivery of the application.</li>
            <li><strong>Resend</strong> — transactional and reminder emails.</li>
            <li><strong>PostHog</strong> — product analytics (only active when configured).</li>
          </ul>
          <P>We disclose data when required by law or to protect the safety, rights, or property of our users and the service.</P>

          <H>4. Data retention and deletion</H>
          <P>We keep your data while your account is active. You can export everything anytime via <strong>Settings → Download my data (JSON)</strong>, and permanently delete your account — including profile, roadmaps, progress, chats, and streaks — via <strong>Settings → Delete account</strong>. Backups expire on their normal cycle after deletion. Server and analytics logs are retained for up to 12 months for security and debugging.</P>

          <H>5. Your rights and choices</H>
          <P>Depending on your region (including GDPR/UK GDPR and CCPA/CPRA rights), you may request access, correction, export, restriction, or deletion of your personal data, and may opt out of reminder emails in Settings. Contact us (below) and we will respond within 30 days. Withdrawing consent for core account data means closing your account, since the service cannot function without it.</P>

          <H>6. Security</H>
          <P>Traffic is encrypted in transit (HTTPS); database access is gated by row-level security plus server-only credentials; authentication sessions are managed by Clerk. No method is 100% secure, and you are responsible for keeping your sign-in credentials confidential.</P>

          <H>7. Children</H>
          <P>HiPath AI is not directed at children under 13, and we do not knowingly collect their data. If you believe a child provided data, contact us and we will delete it.</P>

          <H>8. Cookies and local storage</H>
          <P>We use essential cookies for sign-in sessions (Clerk) and remember preferences such as theme. Your browser&apos;s local storage keeps a cache of your roadmap and drafts for speed and offline reading. See our <Link href="/cookies" className="text-primary underline">Cookie Policy</Link> for details and controls.</P>

          <H>9. International transfers</H>
          <P>Our subprocessors operate primarily in the US and EU. By using HiPath AI you consent to processing in these regions with appropriate contractual safeguards.</P>

          <H>10. Changes to this policy</H>
          <P>We will update the date above and, for material changes, notify you in-app or by email before they take effect.</P>

          <H>11. Contact</H>
          <P>Questions, access/deletion requests, or complaints: <Link href="/contact" className="text-primary underline">contact us</Link> or email privacy@hipathai.me. You also have the right to complain to your local data-protection authority.</P>
        </div>
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">© 2026 HiPath AI — <Link href="/terms" className="underline">Terms</Link> • <Link href="/cookies" className="underline">Cookies</Link></footer>
    </div>
  )
}
