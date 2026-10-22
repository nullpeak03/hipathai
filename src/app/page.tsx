import Link from "next/link"
import { Bricolage_Grotesque, Figtree } from "next/font/google"
import { CheckCircle2 } from "lucide-react"
import { LandingHeaderAuth, LandingHeroAuth, LandingCTAAuth, LandingMobileMenu } from "@/components/landing/LandingAuth"
import { AmbientBackground } from "@/components/effects/ambient-background"
import { TrailMap } from "@/components/landing/trail-map"
import { LoopTabs } from "@/components/landing/loop-tabs"
import styles from "./landing.module.css"

export const dynamic = "force-dynamic"

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-bricolage" })
const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-figtree" })

const FAQS = [
  { q: "Is it really free?", a: "Yes — V1 is completely free, no credit card required. Just sign up and start learning." },
  { q: "What can I learn with HiPath AI?", a: "Anything in computer science and technology — Python, JavaScript, web development, AI agents, data structures, and more. Type any goal and the AI builds your path." },
  { q: "How does the personalized roadmap work?", a: "Tell us your goal, level, and daily time. The AI generates week-by-week phases with bite-size lessons sized to your schedule, then guides you day by day." },
  { q: "How do quizzes and unlocking work?", a: "Every lesson ends with an AI-generated quiz. Score 90% to master the lesson and unlock the next one — adaptive quizzes and spaced review reinforce weak areas." },
  { q: "Does the AI tutor know my progress?", a: "Yes. Your mentor sees your roadmap, your current lesson, and your weak areas, and adapts explanations and practice to exactly what you struggle with." },
  { q: "Can I edit my roadmap?", a: "Yes — the roadmap page has Edit and Delete. Edit reopens onboarding with your answers so you can adjust goal, level, or schedule anytime." },
  { q: "Do I need experience to start?", a: "No. Complete beginners get plain-words explanations with runnable examples; advanced learners get edge cases and trade-offs. The difficulty adapts to you." },
]

function StructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "HiPath AI",
        url: "https://www.hipathai.me/",
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        description:
          "Personalized AI learning roadmaps with adaptive quizzes and a persistent AI tutor for computer science and technology.",
      },
      {
        "@type": "Organization",
        name: "HiPath AI",
        url: "https://www.hipathai.me/",
        logo: "https://www.hipathai.me/icon.svg",
      },
      {
        "@type": "WebSite",
        name: "HiPath AI",
        url: "https://www.hipathai.me/",
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

const WEEK = ["M", "T", "W", "T", "F", "S", "S"]

export default function Landing() {
  return (
    <div className={`${styles.root} ${bricolage.variable} ${figtree.variable} min-h-screen flex flex-col`}>
      <StructuredData />
      {/* Header (auth-aware, kept) */}
      <header className="h-16 border-b border-border flex items-center justify-between px-4 sm:px-6 max-w-7xl mx-auto w-full sticky top-0 bg-card/80 backdrop-blur z-20">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group"><div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold transition-transform duration-200 group-hover:scale-110 group-hover:shadow-md">H</div><span className="font-bold">HiPath AI</span></Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#loop" className="relative py-1 hover:text-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-primary hover:after:w-full after:transition-all after:duration-200">How you learn</a>
            <a href="#mentor" className="relative py-1 hover:text-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-primary hover:after:w-full after:transition-all after:duration-200">Mentor</a>
            <a href="#faq" className="relative py-1 hover:text-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-primary hover:after:w-full after:transition-all after:duration-200">FAQ</a>
            <Link href="/roadmaps" className="relative py-1 hover:text-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-primary hover:after:w-full after:transition-all after:duration-200">Library</Link>
            <Link href="/privacy" className="relative py-1 hover:text-foreground transition-colors after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-primary hover:after:w-full after:transition-all after:duration-200">Privacy</Link>
          </nav>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <LandingHeaderAuth />
        </div>
        <LandingMobileMenu />
      </header>

      <main className="flex-1 flex flex-col items-center">
        {/* Hero */}
        <div className="relative w-full max-w-7xl px-6">
          <AmbientBackground />
          <div className={styles.wrap}>
            <div className={styles.hero}>
              <div>
                <div className="inline-flex items-center gap-2 text-xs bg-info-bg border border-info-border rounded-full px-3 py-1 text-info-fg mb-6">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> HiPath AI • AI-Powered Learning Platform
                </div>
                <h1 className={styles.heroTitle}>Tell it your goal. Walk the path it builds.</h1>
                <p className={styles.heroSub}>
                  HiPath AI turns any computer science goal into a week-by-week roadmap, teaches each
                  lesson, and unlocks the next one only when you pass the quiz.
                </p>
                <div className={styles.row}>
                  <LandingHeroAuth />
                  <a href="#loop" className={`${styles.btn} ${styles.btnGhost}`}>See how it teaches</a>
                </div>
                <div className="mt-4 flex items-center gap-6 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> No credit card</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Free for V1</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Cancel anytime</span>
                </div>
              </div>
              <TrailMap />
            </div>
          </div>
        </div>

        {/* What is HiPath AI — purpose statement (SEO + OAuth, kept) */}
        <section className="w-full max-w-3xl px-6 pb-4 text-center">
          <h2 className="text-xl sm:text-2xl font-bold">What is HiPath AI?</h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
            HiPath AI is an AI-powered learning platform for computer science and technology.
            Its purpose is simple: turn any learning goal — Python, web development, AI agents —
            into a personalized week-by-week roadmap, teach each lesson with an AI tutor that
            remembers your progress, verify understanding with adaptive quizzes, and keep you
            consistent with streaks and spaced reviews.
          </p>
          <Link href="/roadmaps" className="inline-block mt-4 text-sm text-primary underline underline-offset-4">
            Browse the free roadmap library →
          </Link>
        </section>

        {/* Learning loop */}
        <section id="loop" className={`w-full max-w-7xl px-6 ${styles.section}`}>
          <div className={styles.wrap}>
            <h2 className={styles.h2}>Every lesson follows the same four steps</h2>
            <p className={styles.sub}>Pick a step to see what you get. You can&apos;t skip ahead, so each step builds on the last.</p>
            <LoopTabs />
          </div>
        </section>

        {/* Mentor */}
        <section id="mentor" className={`w-full max-w-7xl px-6 ${styles.section}`}>
          <div className={styles.wrap}>
            <div className={styles.chat}>
              <div>
                <h2 className={styles.h2}>A mentor that remembers where you got stuck</h2>
                <p className={styles.sub}>It sees your roadmap, your current lesson, and your weak spots, then picks practice to match.</p>
                <div className={styles.stat}>6-day streak</div>
                <div className={styles.week} aria-label="This week">
                  {WEEK.map((d, i) => (
                    <div key={`${d}-${i}`} className={`${styles.day} ${i < 6 ? styles.dayOn : ""}`}>{d}</div>
                  ))}
                </div>
                <span className={styles.pill}>142 min this week</span>
              </div>
              <div>
                <div className={`${styles.bub} ${styles.bubMe}`}>Why did I fail the closures quiz?</div>
                <div className={`${styles.bub} ${styles.bubAi}`}>
                  Likely mixing scope with hoisting — retry the visual analogy in lesson 3…
                  <br /><br />
                  <span className={styles.tag}>Closures · missed 2×</span>
                  <span className={styles.tag}>Review due</span>
                </div>
                <div className={`${styles.bub} ${styles.bubMe}`}>Quiz me on it.</div>
                <div className={`${styles.bub} ${styles.bubAi}`}>Ready. Question 1 of 4 is in your queue. <Link href="/tutor" className="underline">Open tutor →</Link></div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ (same Q&A as JSON-LD — keep parity) */}
        <section id="faq" className="w-full max-w-3xl px-6 py-16">
          <h2 className={`${styles.h2} text-center`}>Questions, answered</h2>
          <div className={styles.faqList}>
            {FAQS.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="w-full max-w-7xl px-6 pb-16">
          <div className={styles.wrap}>
            <div className={styles.cta}>
              <h2 className={styles.h2}>Your first lesson is five minutes away</h2>
              <div className="mt-6 flex justify-center gap-3">
                <LandingCTAAuth />
                <Link href="/privacy" className="text-sm underline self-center" style={{ color: "#fff" }}>Privacy</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer with legal + sitemap */}
      <footer className="border-t border-border py-8 bg-card">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-6 text-sm">
          <div>
            <div className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">H</div><span className="font-semibold">HiPath AI</span></div>
            <p className="text-muted-foreground mt-2 max-w-xs">Your Personal AI Learning Navigator — CS & Technology focus. Flexible, adaptive, mentor-driven.</p>
          </div>
          <div className="flex gap-12">
            <div className="space-y-2">
              <div className="font-medium">Product</div>
              <div className="flex flex-col gap-1 text-muted-foreground">
                <a href="#loop" className="hover:text-foreground transition-colors w-fit">How you learn</a>
                <a href="#faq" className="hover:text-foreground transition-colors w-fit">FAQ</a>
                <Link href="/roadmaps" className="hover:text-foreground transition-colors w-fit">Roadmap Library</Link>
                <Link href="/guides" className="hover:text-foreground transition-colors w-fit">Guides</Link>
                <Link href="/product-roadmap" className="hover:text-foreground transition-colors w-fit">Product Roadmap</Link>
                <Link href="/changelog" className="hover:text-foreground transition-colors w-fit">Changelog</Link>
              </div>
            </div>
            <div className="space-y-2">
              <div className="font-medium">Legal</div>
              <div className="flex flex-col gap-1 text-muted-foreground">
                <Link href="/privacy" className="hover:text-foreground transition-colors w-fit">Privacy Policy</Link>
                <Link href="/terms" className="hover:text-foreground transition-colors w-fit">Terms of Service</Link>
                <Link href="/cookies" className="hover:text-foreground transition-colors w-fit">Cookie Policy</Link>
                <Link href="/contact" className="hover:text-foreground transition-colors w-fit">Contact</Link>
              </div>
            </div>
          </div>
        </div>
        <div className="text-center text-xs text-muted-foreground mt-8">© 2026 HiPath AI — All rights reserved.</div>
      </footer>
    </div>
  )
}
