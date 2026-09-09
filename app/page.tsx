import Link from "next/link";
import { Logo } from "@/components/Logo";

const tracks = ["Frontend", "Backend", "Full-stack", "AI/ML", "DevOps", "Mobile", "DSA"];

const phases = [
  { n: "01", t: "Foundations", d: "HTML · CSS · JS · Git", s: "done" },
  { n: "02", t: "React + Next.js", d: "App Router · Data fetching", s: "current" },
  { n: "03", t: "Backend APIs", d: "Postgres · Auth · Caching", s: "locked" },
  { n: "04", t: "Projects", d: "GitHub review · Ship v1", s: "locked" },
];

const features = [
  { t: "Roadmap generator", d: "Ultra plans your tech path from goal, level, hours and deadline. Versioned, never generic." },
  { t: "Adapts over time", d: "Fails, skips and Struggling flags auto-reschedule and inject remedial nodes." },
  { t: "Lesson player", d: "Split view: AI lesson + code on the left, curated videos and summaries on the right." },
  { t: "Quiz gate", d: "Generate a quiz per lesson. Pass at 70% to unlock the next node. Difficulty adapts to you." },
  { t: "Socratic tutor", d: "Knows your roadmap, current node and last failures. Guides, never spoils." },
  { t: "Projects", d: "Ship to GitHub, get rubric review. GitHub Guide built in for first-timers." },
];

const faqs = [
  { q: "Is HiPath AI really free?", a: "Yes. v1 is 100% free with fair daily AI caps so inference stays sustainable." },
  { q: "Which skills does it cover?", a: "Tech only in v1: frontend, backend, full-stack, AI/ML, DevOps, mobile and DSA." },
  { q: "Do I need GitHub?", a: "For full project XP, yes — a public repo. A built-in GitHub Guide walks you through it, and paste-mode earns half XP." },
  { q: "Does it work offline?", a: "It's a PWA: install it, keep reading lessons offline, quizzes sync when you're back." },
];

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-[#050A08] text-[#E6F4ED]">
      {/* nav */}
      <header className="sticky top-0 z-10 border-b border-[#10B98122] bg-[#050A08]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-[#8BA494] md:flex">
            <a href="#how" className="hover:text-[#E6F4ED]">How it works</a>
            <a href="#features" className="hover:text-[#E6F4ED]">Features</a>
            <a href="#sample" className="hover:text-[#E6F4ED]">Sample path</a>
            <a href="#faq" className="hover:text-[#E6F4ED]">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className="rounded-lg px-4 py-2 text-sm text-[#8BA494] hover:text-[#E6F4ED]"
            >
              Sign in
            </Link>
            <Link
              href="/onboarding"
              className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#050A08] hover:bg-[#34D399]"
            >
              Start Building Free
            </Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-16 pt-14 md:grid-cols-2 md:pt-20">
        <div>
          <p className="mb-4 inline-block rounded-full border border-[#10B98133] bg-[#0A120E] px-3 py-1 font-mono text-xs text-[#34D399]">
            v1 · free forever · tech-only
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Stop tutorial hell.
            <br />
            <span className="text-[#10B981]">&gt; learn_to_ship()</span>
          </h1>
          <p className="mt-5 max-w-md text-[#8BA494]">
            HiPath AI turns your goal into a living roadmap — lessons, quiz-gated
            unlocks, a Socratic tutor and GitHub project reviews. One active path,
            always adapted to you.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/onboarding"
              className="rounded-lg bg-[#10B981] px-6 py-3 font-semibold text-[#050A08] hover:bg-[#34D399]"
            >
              Generate My Path
            </Link>
            <a
              href="#sample"
              className="rounded-lg border border-[#10B98133] px-6 py-3 text-[#E6F4ED] hover:border-[#10B981]"
            >
              See sample path
            </a>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {tracks.map((t) => (
              <span key={t} className="rounded-full border border-[#10B98122] px-3 py-1 text-xs text-[#8BA494]">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* terminal mock */}
        <div className="terminal-card overflow-hidden">
          <div className="flex items-center gap-1.5 border-b border-[#10B98122] px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#F87171]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FBBF24]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
            <span className="ml-2 font-mono text-xs text-[#8BA494]">hipath — generating</span>
          </div>
          <div className="space-y-2 px-4 py-4 font-mono text-[13px] leading-relaxed">
            <p><span className="text-[#10B981]">&gt;</span> <span className="text-[#8BA494]">Analyzing goal… “Next.js freelancer in 3 months”</span></p>
            <p><span className="text-[#10B981]">&gt;</span> <span className="text-[#8BA494]">Splitting into 4 phases · 18 nodes</span></p>
            <p><span className="text-[#10B981]">&gt;</span> <span className="text-[#8BA494]">Calibrating difficulty… intermediate · 2h/day</span></p>
            <p><span className="text-[#10B981]">&gt;</span> <span className="text-[#E6F4ED]">Path ready — lesson 1 unlocked ✓</span></p>
          </div>
          <div className="space-y-2 border-t border-[#10B98122] px-4 py-4">
            {phases.map((p) => (
              <div key={p.n} className="flex items-center gap-3 rounded-lg border border-[#10B98118] bg-[#060D0A] px-3 py-2.5">
                <span className="font-mono text-xs text-[#34D399]">{p.n}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{p.t}</p>
                  <p className="text-xs text-[#8BA494]">{p.d}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] ${
                  p.s === "done" ? "bg-[#10B98122] text-[#34D399]"
                  : p.s === "current" ? "bg-[#10B981] text-[#050A08]"
                  : "bg-[#8BA49418] text-[#8BA494]"
                }`}>
                  {p.s === "done" ? "done" : p.s === "current" ? "open" : "locked"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* how */}
      <section id="how" className="border-t border-[#10B98118] bg-[#070D0A]">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 py-14 md:grid-cols-4">
          {[
            ["1", "Onboard", "Goal, level, hours, deadline — 2 minutes."],
            ["2", "Generate", "Watch your path build live in the terminal."],
            ["3", "Learn + pass", "Lesson, quiz at 70%, next unlocks."],
            ["4", "Ship", "GitHub projects reviewed by AI."],
          ].map(([n, t, d]) => (
            <div key={n} className="terminal-card p-5">
              <p className="font-mono text-2xl text-[#10B981]">{n}</p>
              <p className="mt-2 font-semibold">{t}</p>
              <p className="mt-1 text-sm text-[#8BA494]">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="font-display text-2xl font-bold md:text-3xl">Everything to finish, <span className="text-[#10B981]">nothing to get lost in</span></h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.t} className="terminal-card p-5">
              <p className="font-semibold text-[#E6F4ED]">{f.t}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#8BA494]">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* tutor demo */}
      <section className="border-t border-[#10B98118] bg-[#070D0A]">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-bold md:text-3xl">A tutor that <span className="text-[#10B981]">guides, never spoils</span></h2>
            <p className="mt-3 text-[#8BA494]">Context-aware and Socratic: it knows your roadmap, current lesson and last quiz failures — and asks before it tells.</p>
            <ul className="mt-5 space-y-2 text-sm text-[#8BA494]">
              <li>✓ Streams answers, saves threads per lesson</li>
              <li>✓ Falls back to fast mode instead of erroring</li>
              <li>✓ Explains your project feedback line by line</li>
            </ul>
          </div>
          <div className="terminal-card space-y-3 p-4 text-sm">
            <p className="ml-auto w-fit rounded-lg bg-[#10B98122] px-3 py-2">why is my useEffect fetching twice?</p>
            <p className="w-fit rounded-lg bg-[#060D0A] px-3 py-2 text-[#8BA494]">Good question — what does your dependency array look like, and are you in StrictMode? Paste the effect and I’ll hint, not solve. <span className="font-mono text-[11px] text-[#34D399]">· knows: React lesson 4, quiz miss: closures</span></p>
            <p className="ml-auto w-fit rounded-lg bg-[#10B98122] px-3 py-2">[] deps, dev only… oh — mount, unmount, remount?</p>
            <p className="w-fit rounded-lg bg-[#060D0A] px-3 py-2 text-[#8BA494]">Exactly. So where should the cleanup go? 🎯</p>
          </div>
        </div>
      </section>

      {/* sample */}
      <section id="sample" className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="font-display text-2xl font-bold md:text-3xl">Sample: <span className="text-[#10B981]">Frontend in 8 weeks</span></h2>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {["Week 1–2 JS deep-dive + Git", "Week 3–4 React + Next.js App Router", "Week 5–6 APIs + Postgres + Auth", "Week 7–8 Portfolio + freelance project"].map((s, i) => (
            <div key={s} className="terminal-card flex items-center gap-3 p-4">
              <span className="font-mono text-[#34D399]">0{i + 1}</span>
              <span className="text-sm">{s}</span>
            </div>
          ))}
        </div>
      </section>

      {/* pricing */}
      <section className="border-t border-[#10B98118] bg-[#070D0A]">
        <div className="mx-auto max-w-6xl px-5 py-14 text-center">
          <h2 className="font-display text-2xl font-bold md:text-3xl">Free forever <span className="text-[#10B981]">in v1</span></h2>
          <p className="mx-auto mt-3 max-w-lg text-[#8BA494]">Every feature unlocked. Fair daily AI caps keep the lights on — no card, no trial, no paywall.</p>
          <Link href="/onboarding" className="mt-6 inline-block rounded-lg bg-[#10B981] px-8 py-3 font-semibold text-[#050A08] hover:bg-[#34D399]">
            Start Building Free
          </Link>
        </div>
      </section>

      {/* faq */}
      <section id="faq" className="mx-auto max-w-3xl px-5 py-14">
        <h2 className="font-display text-2xl font-bold">FAQ</h2>
        <div className="mt-6 space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="terminal-card group px-5 py-4">
              <summary className="cursor-pointer font-semibold">{f.q}</summary>
              <p className="mt-2 text-sm text-[#8BA494]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#10B98118]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-[#8BA494] md:flex-row">
          <Logo compact />
          <p className="font-mono text-xs">HiPath AI · learn_to_ship() · PWA · free forever in v1</p>
        </div>
      </footer>
    </div>
  );
}
