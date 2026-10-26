import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Check, Sparkles } from "lucide-react"
import { PricingWaitlistForm } from "@/components/pricing/pricing-waitlist-form"

export const metadata: Metadata = {
  title: "Pricing — Free learning, more room to grow",
  description:
    "Learn for free with complete roadmaps, lessons, practice, and quizzes. HiPath Pro is planned for learners who want more AI capacity and deeper insights.",
  alternates: { canonical: "https://www.hipathai.me/pricing" },
}

const included = [
  "Complete generated roadmaps and lesson progression",
  "Teach, Example, Practice, and Quiz lesson flow",
  "Basic progress tracking and spaced reviews",
  "Private capstone evidence",
]

const proFeatures = [
  ["AI mentor", "10 prompts per day", "1,000 prompts per month"],
  ["New AI roadmaps", "2 per month", "10 per month"],
  ["Roadmap adaptations", "1 generated proposal per roadmap", "20 generated proposals per month"],
  ["Code runner", "30 runs per day", "2,000 runs per month"],
  ["Learning insights", "Basic progress", "Mastery trends and weak-skill recovery insights"],
  ["Spaced reviews", "Basic review access", "Personalized scheduling and deeper mastery insights"],
]

const faqs = [
  {
    question: "Will I need Pro to keep learning?",
    answer:
      "No. Core lessons, practice, quizzes, progression, and the full learning journey for a generated roadmap stay available on Free.",
  },
  {
    question: "Are these Pro allowances final?",
    answer:
      "They are planning targets. We’ll validate AI and infrastructure costs before launch, so the final allowances may change. We’ll publish any final limits clearly before paid subscriptions become available.",
  },
  {
    question: "What happens when I reach a Free limit?",
    answer:
      "You’ll see a dismissible notice with the limit and its reset time. It won’t block core lessons or progression.",
  },
  {
    question: "Can I cancel a subscription?",
    answer:
    "Pro is not available to purchase yet. When it launches, you can cancel renewal at any time and keep Pro access through the paid period. See the Refund & Cancellation Policy for details.",
  },
  {
    question: "Who will be able to pay for Pro?",
    answer:
      "Pro is not available to purchase yet. The plan is for an adult to pay, including a parent or guardian paying for an eligible learner aged 13–17 with explicit confirmation. HiPath is not directed at children under 13.",
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border px-5 sm:px-6">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">H</span>
            HiPath AI
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="hidden text-muted-foreground hover:text-foreground sm:inline">Home</Link>
            <Link href="/sign-in" className="text-muted-foreground hover:text-foreground">Sign in</Link>
            <Link href="/sign-up" className="rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground hover:opacity-90">Start free</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-16">
        <section className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Learning that stays yours
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">Build real skills. Start free.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            HiPath helps you turn a learning goal into a guided journey. The complete learning path is free;
            Pro is planned for learners who want more AI capacity and deeper personalization.
          </p>
        </section>

        <section aria-label="Plans" className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
          <article className="flex flex-col rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Free</p>
              <p className="mt-3 text-4xl font-bold">$0 <span className="text-base font-normal text-muted-foreground">forever</span></p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Everything you need to follow a complete learning roadmap.</p>
            </div>
            <ul className="mt-6 flex-1 space-y-3 text-sm">
              {included.map((feature) => (
                <li key={feature} className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>{feature}</span></li>
              ))}
              <li className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>2 new AI roadmaps per month</span></li>
              <li className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>10 AI mentor prompts and 30 code runs per day</span></li>
            </ul>
            <Link href="/sign-up" className="mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border font-semibold hover:bg-muted">
              Start learning free <ArrowRight className="h-4 w-4" />
            </Link>
          </article>

          <article className="relative flex flex-col rounded-3xl border-2 border-primary bg-card p-6 shadow-lg shadow-primary/5 sm:p-8">
            <span className="absolute right-5 top-5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">COMING SOON</span>
            <div>
              <p className="text-sm font-semibold text-primary">HiPath Pro</p>
              <p className="mt-3 text-4xl font-bold">$4.99 <span className="text-base font-normal text-muted-foreground">/ month</span></p>
              <p className="mt-1 text-sm text-muted-foreground">Or $49.90 / year — about two months free.</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">More room for AI-guided learning and insight into how your skills are growing.</p>
            </div>
            <ul className="mt-6 flex-1 space-y-3 text-sm">
              {proFeatures.map(([name, free, pro]) => (
                <li key={name} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span><strong>{name}:</strong> {pro}<span className="sr-only"> (Free: {free})</span></span>
                </li>
              ))}
            </ul>
            <Link href="#pro-waitlist" className="mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground hover:opacity-90">
              Get launch notification <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-3 text-center text-xs text-muted-foreground">Coming soon · No payment details or commitment</p>
          </article>
        </section>

        <p className="mx-auto mt-5 max-w-4xl text-center text-xs leading-5 text-muted-foreground">
          The Pro launch price is set at $4.99/month or $49.90/year in USD. Any applicable taxes and final checkout total will be shown before purchase.
          Pro is not available to purchase yet; feature allowances remain planned targets and may change before launch.
        </p>

        <section aria-labelledby="plan-comparison-title" className="mx-auto mt-12 max-w-4xl">
          <h2 id="plan-comparison-title" className="text-center text-2xl font-bold">Compare the plans</h2>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[620px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th scope="col" className="px-4 py-3 font-semibold">Feature</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Free</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-primary">Pro · planned</th>
                </tr>
              </thead>
              <tbody>
                {proFeatures.map(([name, free, pro]) => (
                  <tr key={name} className="border-b border-border last:border-0">
                    <th scope="row" className="px-4 py-3 font-medium">{name}</th>
                    <td className="px-4 py-3 text-muted-foreground">{free}</td>
                    <td className="px-4 py-3">{pro}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="px-4 py-3 font-medium">Core lessons and progression</th>
                  <td className="px-4 py-3 text-muted-foreground">Complete learning journey</td>
                  <td className="px-4 py-3">Complete learning journey</td>
                </tr>
                <tr>
                  <th scope="row" className="px-4 py-3 font-medium">Private capstone evidence</th>
                  <td className="px-4 py-3 text-muted-foreground">Included</td>
                  <td className="px-4 py-3">Included</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <p className="mx-auto mt-4 max-w-4xl text-center text-xs leading-5 text-muted-foreground">
          Planned resets: Free daily limits use a rolling 24-hour window; Free roadmap generations reset monthly at 00:00 UTC.
          Pro monthly allowances renew on each subscription’s monthly anniversary, including annual plans, and do not roll over.
          Successful usable AI results count toward allowances; failed requests do not.
        </p>

        <section id="pro-waitlist" className="mx-auto mt-14 max-w-3xl scroll-mt-8 rounded-3xl border border-border bg-muted/40 p-6 sm:p-8">
          <div className="grid gap-6 md:grid-cols-[1fr_1.1fr] md:items-center">
            <div>
              <h2 className="text-2xl font-bold">Be first to know when Pro is ready</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Confirm your email and we’ll send one notification when Pro launches. No newsletters or ongoing marketing.
              </p>
            </div>
            <PricingWaitlistForm />
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-3xl">
          <h2 className="text-center text-2xl font-bold">Pricing questions</h2>
          <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card px-5">
            {faqs.map((item) => (
              <details key={item.question} className="group py-4">
                <summary className="cursor-pointer list-none pr-6 text-sm font-semibold marker:hidden">
                  {item.question}
                  <span className="float-right text-muted-foreground transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-6 text-center text-xs text-muted-foreground">
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/refund" className="hover:text-foreground">Refunds & cancellations</Link>
          <Link href="/contact" className="hover:text-foreground">Contact</Link>
        </div>
        <p className="mt-3">© 2026 HiPath AI</p>
      </footer>
    </div>
  )
}
