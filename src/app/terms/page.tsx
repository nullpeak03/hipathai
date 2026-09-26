import Link from "next/link"
export const metadata = { title: "Terms of Service — HiPath AI" }

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold mt-8">{children}</h2>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-2">{children}</p>
}

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b flex items-center px-6 max-w-4xl mx-auto w-full justify-between">
        <Link href="/" className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">H</div><span className="font-bold">HiPath AI</span></Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Back to home</Link>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mt-2">Last updated: September 25, 2026</p>
        <div className="prose max-w-none mt-8 text-sm leading-relaxed">
          <P>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your use of HiPath AI at{" "}
            <Link href="/" className="text-primary underline">hipathai.me</Link> (&ldquo;the service&rdquo;),
            an AI-powered learning navigator for computer science and technology. By creating an
            account or using the service, you agree to these Terms. If you do not agree, please do
            not use the service.
          </P>

          <H>1. The service</H>
          <P>HiPath AI generates personalized learning roadmaps, lesson content, quizzes, and AI tutor guidance from the goals and preferences you provide. V1 of the service is free. We may introduce paid tiers in the future with advance notice; continued use after changes take effect constitutes acceptance.</P>

          <H>2. Eligibility and accounts</H>
          <P>You must be at least 13 years old to use HiPath AI. You sign in via Clerk (Google, GitHub, or email) and are responsible for keeping your credentials confidential and for all activity under your account. Provide accurate onboarding information — the quality of your roadmaps depends on it. We may suspend or terminate accounts that abuse the service, attempt to circumvent rate limits, or violate these Terms.</P>

          <H>3. Acceptable use</H>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Use the service for lawful personal learning only.</li>
            <li>Do not abuse AI generation (per-user hourly rate limits apply), scrape content at scale, or interfere with other users.</li>
            <li>Do not attempt to access other users&apos; data, reverse-engineer usage restrictions, or submit unlawful or infringing content to the tutor.</li>
            <li>Do not rely on AI-generated content for safety-critical, medical, legal, or financial decisions.</li>
          </ul>

          <H>4. AI-generated content disclaimer</H>
          <P>Roadmaps, lessons, quizzes, code examples, and tutor replies are produced by AI models and may contain errors, omissions, or outdated information. Code examples are educational illustrations — review and test them before use in real projects. We aim for accuracy through validation and retries but do not guarantee correctness, completeness, or fitness for any purpose. Report mistakes via <Link href="/contact" className="text-primary underline">Contact</Link> and we will use reports to improve generation.</P>

          <H>5. Your content and our license</H>
          <P>You retain ownership of the learning goals, messages, and other content you submit (&ldquo;Your Content&rdquo;). You grant us a worldwide, non-exclusive license to store, process, and display Your Content solely to operate the service (including AI processing described in our <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>). Generated learning materials are provided to you for personal, non-commercial learning use; you may keep notes and code for your own study but may not resell or redistribute generated content at scale.</P>

          <H>6. Intellectual property</H>
          <P>The HiPath AI name, logo, interface, and software are our property and may not be copied, modified, or reverse-engineered except as permitted by law. Feedback you voluntarily provide may be used to improve the service without compensation.</P>

          <H>7. Your data, export, and deletion</H>
          <P>How we collect, use, and share data is described in our <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>. You can export all your data anytime via <strong>Settings → Download my data (JSON)</strong> and permanently delete your account — including roadmaps, progress, chats, and streaks — via <strong>Settings → Delete account</strong>.</P>

          <H>8. Availability and changes</H>
          <P>We strive for reliable service but do not guarantee uninterrupted availability; AI providers, hosting, or maintenance may cause downtime or degraded generation. We may modify or discontinue features with reasonable notice for material changes.</P>

          <H>9. Limitation of liability</H>
          <P>To the maximum extent permitted by law, HiPath AI is provided &ldquo;as is&rdquo; without warranties of any kind. We are not liable for learning outcomes, decisions made from AI content, or indirect, incidental, or consequential damages. Our total liability is limited to the amounts you paid us in the 12 months before the claim (currently €0 on the free tier).</P>

          <H>10. Termination</H>
          <P>You may stop using the service and delete your account at any time. We may suspend or terminate access for Terms violations, with deletion of associated data per our Privacy Policy. Sections 5, 6, and 9 survive termination.</P>

          <H>11. General</H>
          <P>If any provision is found unenforceable, the remainder continues in effect. Our failure to enforce a provision is not a waiver. Questions about these Terms: <Link href="/contact" className="text-primary underline">contact us</Link>.</P>
        </div>
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">© 2026 HiPath AI — <Link href="/privacy" className="underline">Privacy</Link> • <Link href="/cookies" className="underline">Cookies</Link></footer>
    </div>
  )
}
