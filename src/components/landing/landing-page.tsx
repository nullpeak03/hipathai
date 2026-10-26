"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Check, ChevronRight, CircleCheck, LockKeyhole, Play, RotateCcw, Sparkles } from "lucide-react"
import {
  LandingCTAAuth,
  LandingHeaderAuth,
  LandingHeroAuth,
  LandingMobileMenu,
} from "@/components/landing/LandingAuth"
import { LESSON_PASS_THRESHOLD, V2_MASTERY_THRESHOLD } from "@/lib/v2-mastery"
import styles from "./landing-page.module.css"

const steps = [
  {
    number: "01",
    label: "Foundation",
    title: "Teach",
    description: "One idea, explained at your level.",
    detailTitle: "Mental model",
    detail: ["Build a clear picture of the concept", "Understand why it works"],
  },
  {
    number: "02",
    label: "Validation",
    title: "Example",
    description: "See it run before you write any.",
    detailTitle: "Try it out",
    detail: ["Follow a runnable example", "See what the code produces"],
  },
  {
    number: "03",
    label: "Active recall",
    title: "Practice",
    description: "Exercises aimed at what you missed.",
    detailTitle: "Fill the blank",
    detail: ["Apply the idea yourself", "Get a hint when you need it"],
  },
  {
    number: "04",
    label: "Checkpoint",
    title: "Quiz",
    description: `Score ${LESSON_PASS_THRESHOLD}% or more to unlock the next lesson.`,
    detailTitle: "Next module",
    detail: ["Check what you understand", "Move forward when you pass"],
  },
]

const faqs = [
  {
    question: "Is it really free?",
    answer: "Yes. HiPath AI is free in V1 and does not require a credit card.",
  },
  {
    question: "What can I learn?",
    answer: "Explore computer science and technology topics like Python, web development, AI agents, and data structures.",
  },
  {
    question: "How does unlocking work?",
    answer: `Score ${LESSON_PASS_THRESHOLD}% or more on a lesson quiz to unlock the next lesson. You can retry a quiz if you need more practice. Reach ${V2_MASTERY_THRESHOLD}% to mark a lesson mastered.`,
  },
  {
    question: "Can I change my roadmap?",
    answer: "Yes. You can update your goal, level, or schedule and adjust your learning path as your plans change.",
  },
  {
    question: "Do I need experience?",
    answer: "No. Beginners get plain-language explanations, while more experienced learners can explore edge cases and trade-offs.",
  },
]

export function LandingPage() {
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null)
  const [quizKey, setQuizKey] = useState(0)

  const replayQuiz = () => {
    setAnswer(null)
    setQuizKey((key) => key + 1)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.navWrap}>
          <Link href="/" className={styles.brand} aria-label="HiPath AI home">
            <span className={styles.brandMark}>H</span>
            <span>HiPath AI</span>
          </Link>
          <nav className={styles.desktopNav} aria-label="Main navigation">
            <a href="#how-you-learn">How you learn</a>
            <a href="#mentor">Mentor</a>
            <a href="#faq">FAQ</a>
            <Link href="/roadmaps">Library</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/privacy">Privacy</Link>
          </nav>
          <div className={styles.desktopAuth}><LandingHeaderAuth /></div>
          <LandingMobileMenu />
        </div>
      </header>

      <main>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}><span className={styles.liveDot} />Personal computer science navigator</span>
              <h1 id="hero-title">Tell it your goal.<br /><em>Walk the path</em> it builds.</h1>
              <p className={styles.heroLead}>
                HiPath AI turns any computer science goal into a week-by-week roadmap, teaches each lesson, and unlocks the next one only when you pass the quiz.
              </p>
              <div className={styles.actions}>
                <LandingHeroAuth />
                <a className={`${styles.button} ${styles.buttonLight}`} href="#how-you-learn">
                  <Play aria-hidden="true" size={17} /> See a lesson
                </a>
              </div>
              <div className={styles.trustLine} aria-label="Free in V1, no credit card, edit anytime">
                <span>No credit card</span><i /><span>Free in V1</span><i /><span>Edit anytime</span>
              </div>
            </div>

            <div className={styles.previewWrap}>
              <div className={styles.previewGlow} aria-hidden="true" />
              <article className={styles.preview}>
                <div className={styles.previewHeader}>
                  <div className={styles.previewTitle}><span className={styles.statusDot} />Path: Fullstack Python &amp; Systems</div>
                  <span className={styles.weekPill}>Week 1 of 6</span>
                  <div className={styles.progressLabel}><span>Progress</span><strong>65%</strong></div>
                  <div className={styles.progressTrack}><span /></div>
                </div>
                <div className={styles.lessonMeta}><span>Active lesson</span><code>python_runtime.py</code></div>
                <h2 className={styles.lessonTitle}>Lesson 4: Memory Model &amp; Scope</h2>
                <p className={styles.lessonDescription}>Understand how lexical scope and variables interact before memory cleanup.</p>
                <div className={styles.codeWindow} aria-label="Python code example">
                  <div className={styles.codeHeader}><i /><i /><i /><span>scope_inspector.py</span></div>
                  <pre><code><span className={styles.codeKeyword}>def</span> <span className={styles.codeFunction}>outer_scope</span>():{"\n"}    lexical_target = <span className={styles.codeNumber}>10</span>{"\n"}    <span className={styles.codeKeyword}>def</span> <span className={styles.codeFunction}>inner_scope</span>():{"\n"}        <span className={styles.codeComment}># Captured in closure frame</span>{"\n"}        <span className={styles.codeKeyword}>return</span> lexical_target * <span className={styles.codeNumber}>2</span>{"\n"}    <span className={styles.codeKeyword}>return</span> inner_scope</code></pre>
                </div>
                <div className={styles.unlockBanner}>
                  <div className={styles.unlockIcon}><CircleCheck aria-hidden="true" size={20} /></div>
                  <div className={styles.unlockCopy}><strong>Pass the Functions quiz</strong><span>Lesson 5 unlocked!</span></div>
                  <span className={styles.xpPill}><Sparkles aria-hidden="true" size={15} /> +20 XP</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionTint}`} id="how-you-learn" aria-labelledby="steps-title">
          <div className={styles.container}>
            <SectionHeading eyebrow="Methodology" title="Four steps on every lesson" subtitle="Each step builds on the last, so you can’t skip ahead." id="steps-title" />
            <div className={styles.stepsGrid}>
              {steps.map((step) => (
                <article className={styles.stepCard} key={step.number}>
                  <div className={styles.stepTop}>
                    <span className={step.number === "04" ? `${styles.stepNumber} ${styles.stepNumberGreen}` : styles.stepNumber}>{step.number}</span>
                    <span className={styles.stepTag}>{step.label}</span>
                  </div>
                  <h3>{step.title}</h3>
                  <p className={styles.stepDescription}>{step.description}</p>
                  <div className={styles.stepDetail}>
                    <strong>{step.detailTitle}</strong>
                    {step.detail.map((item) => <span key={item}><Check aria-hidden="true" size={14} />{item}</span>)}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="unlock-title">
          <div className={styles.container}>
            <div className={styles.unlockGrid}>
              <div className={styles.unlockIntro}>
                <span className={styles.sectionEyebrow}>Progression engine</span>
                <h2 id="unlock-title">Pass the quiz, unlock the next lesson</h2>
                <p>Score {LESSON_PASS_THRESHOLD}% or more to move on. Reach {V2_MASTERY_THRESHOLD}% to mark the lesson mastered. Every finished lesson earns 20 XP.</p>
              </div>
              <div className={styles.quizCard} key={quizKey}>
                <div className={styles.quizCardTop}><span>Lesson 4 quiz</span><span>Question 3 of 5</span></div>
                <h3>Does an inner function retain access to its enclosing scope?</h3>
                <div className={styles.quizOptions}>
                  <button className={answer === "yes" ? styles.correctAnswer : ""} onClick={() => setAnswer("yes")} type="button">Yes, through a closure</button>
                  <button className={answer === "no" ? styles.wrongAnswer : ""} onClick={() => setAnswer("no")} type="button">No, scope is discarded</button>
                </div>
                <div className={styles.quizResult} aria-live="polite">
                  {answer === "yes" ? <><CircleCheck aria-hidden="true" size={18} /> Correct — you’re on your way to unlocking the next lesson.</> : answer === "no" ? <>Not quite — review closures and try again.</> : <>Choose an answer to try the sample question.</>}
                </div>
                <div className={styles.quizFooter}>
                  <span><LockKeyhole aria-hidden="true" size={15} /> Pass rate: {LESSON_PASS_THRESHOLD}%</span>
                  <button className={styles.replayButton} onClick={replayQuiz} type="button"><RotateCcw aria-hidden="true" size={15} /> Replay</button>
                </div>
              </div>
              <div className={styles.nextLesson}>
                <article className={styles.unlockedLesson}>
                  <div><span className={styles.unlockedLabel}><Check aria-hidden="true" size={13} /> Unlocked</span><span className={styles.lessonCount}>Lesson 5 of 12</span></div>
                  <h3>Async &amp; Event Loop</h3>
                  <p>Coroutines, awaitables, tasks, and non-blocking I/O execution cycles.</p>
                  <Link href="/sign-up" className={styles.textLink}>Start learning <ArrowRight aria-hidden="true" size={16} /></Link>
                </article>
                <article className={styles.lockedLesson}>
                  <span className={styles.lockedLabel}><LockKeyhole aria-hidden="true" size={14} /> Locked · unlocks after Async</span>
                  <h3>Multithreading &amp; Concurrency</h3>
                  <p>GIL constraints, thread pools, locks, and synchronization primitives.</p>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionTint}`} id="mentor" aria-labelledby="mentor-title">
          <div className={styles.container}>
            <SectionHeading eyebrow="Personalized memory" title="A tutor that remembers where you got stuck" subtitle="It sees your roadmap, your lesson, and the questions you missed, then picks practice to match." id="mentor-title" />
            <div className={styles.mentorPanel}>
              <div className={styles.chatPreview}>
                <div className={styles.userMessage}>Why did I fail the closures quiz?</div>
                <div className={styles.aiMessage}>
                  <div className={styles.mentorName}><span className={styles.brandMarkSmall}>H</span><strong>HiPath Mentor</strong><span>Just now</span></div>
                  <p>You mixed up scope and lifetime. Try the analogy in lesson 3, then retry the quiz.</p>
                  <Link href="/sign-up" className={styles.recommendation}>Review Lesson 3 analogy <ChevronRight aria-hidden="true" size={16} /></Link>
                </div>
              </div>
              <aside className={styles.contextPanel} aria-label="Learner context">
                <div className={styles.contextHeading}><strong>Learner context</strong><span className={styles.statusDot} /></div>
                <div className={styles.contextAlert}><span>Closures · missed 2 times</span><strong>Needs review</strong></div>
                <div className={styles.contextReview}><span>Spaced review</span><strong>Due today</strong></div>
                <div className={styles.contextStats}>
                  <div><span>Consistency</span><strong>6-day streak</strong></div>
                  <div><span>Weekly focus</span><strong>142 min</strong></div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="app-title">
          <div className={styles.container}>
            <SectionHeading eyebrow="Product experience" title="Everything in one calm place" subtitle="Your day, your roadmap, your tutor, and your numbers." id="app-title" />
            <div className={styles.productGrid}>
              <article className={`${styles.productCard} ${styles.productWide}`}>
                <div className={styles.productEyebrow}>Dashboard · Today</div>
                <div className={styles.metricGrid}>
                  <Metric value="60m" label="studied" />
                  <Metric value="3" label="lessons done" />
                  <Metric value="4-day" label="streak" />
                </div>
                <div className={styles.nextStep}><span>Next step</span><strong>String Essentials</strong><Link href="/sign-up">Continue <ArrowRight aria-hidden="true" size={15} /></Link></div>
              </article>
              <article className={`${styles.productCard} ${styles.productWide}`}>
                <div className={styles.productEyebrow}>Roadmap navigator <span className={styles.livePill}>Live path</span></div>
                <div className={styles.roadmapRow}><span><i className={styles.statusDot} /> Week 1 · 3 of 7 done</span><strong>42%</strong></div>
                <div className={`${styles.roadmapRow} ${styles.roadmapLocked}`}><span><LockKeyhole aria-hidden="true" size={15} /> Week 2</span><span>Locked</span></div>
                <div className={`${styles.roadmapRow} ${styles.roadmapLocked}`}><span><LockKeyhole aria-hidden="true" size={15} /> Week 3</span><span>Locked</span></div>
              </article>
              <article className={styles.productCard}>
                <div className={styles.productEyebrow}>AI instant debugger</div>
                <pre className={styles.inlineCode}><code>name = <span>&quot;Ada&quot;</span>{"\n"}print(f<span>&quot;User: {"{name}"}&quot;</span>)</code></pre>
                <p><strong>String interpolation:</strong> An f-string formats expressions inside curly braces at runtime.</p>
                <span className={styles.productFootnote}>Ask questions directly inside a lesson.</span>
              </article>
              <article className={styles.productCard}>
                <div className={styles.productEyebrow}>Mastery metrics <span className={styles.livePill}>Level 1</span></div>
                <div className={styles.masteryNumbers}><div><strong>91 XP</strong><span>Earned</span></div><div><strong>100%</strong><span>Pass rate</span></div></div>
                <div className={styles.xpProgressLabel}><span>91 / 100 XP to Level 2</span><strong>9 XP left</strong></div>
                <div className={styles.progressTrack}><span className={styles.progress91} /></div>
              </article>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionTint}`} aria-labelledby="audience-title">
          <div className={styles.container}>
            <SectionHeading eyebrow="Tailored pathways" title="Built for people starting from zero" subtitle="No gatekeeping, no assumed jargon, just deliberate progression." id="audience-title" />
            <div className={styles.audienceGrid}>
              <AudienceCard number="01" title="Complete beginners" text="Plain explanations and runnable examples, one step at a time." />
              <AudienceCard number="02" title="Students" text="Fill the gaps your classes skip, at a pace that fits." />
              <AudienceCard number="03" title="Career-switchers" text="A clear plan from basics to projects in short sessions." />
            </div>
          </div>
        </section>

        <section className={styles.section} id="faq" aria-labelledby="faq-title">
          <div className={styles.containerNarrow}>
            <SectionHeading eyebrow="Clarifications" title="Questions, answered" subtitle="Everything you need to know about starting your path." id="faq-title" />
            <div className={styles.faqList}>
              {faqs.map((faq, index) => (
                <details className={styles.faqItem} key={faq.question} open={index === 0}>
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.finalCta} aria-labelledby="cta-title">
          <div className={styles.ctaCard}>
            <span className={styles.ctaOrnament} aria-hidden="true">✳</span>
            <h2 id="cta-title">Your first lesson is five minutes away</h2>
            <LandingCTAAuth />
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Link href="/" className={styles.brand}><span className={styles.brandMark}>H</span><span>HiPath AI</span></Link>
            <p>Your personal AI learning navigator — computer science and technology, at your pace.</p>
          </div>
          <div className={styles.footerLinks}>
            <div>
              <strong>Explore</strong>
              <Link href="/roadmaps">Roadmap library</Link>
              <Link href="/guides">Guides</Link>
              <Link href="/pricing">Pricing</Link>
              <a href="#faq">FAQ</a>
            </div>
            <div>
              <strong>Company</strong>
              <Link href="/about">About HiPath</Link>
              <Link href="/changelog">Changelog</Link>
              <Link href="/contact">Contact</Link>
            </div>
            <div>
              <strong>Legal</strong>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/cookies">Cookies</Link>
            </div>
          </div>
          <div className={styles.copyright}>© 2026 HiPath AI. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}

function SectionHeading({ eyebrow, title, subtitle, id }: { eyebrow: string; title: string; subtitle: string; id: string }) {
  return (
    <div className={styles.sectionHeading}>
      <span className={styles.sectionEyebrow}>{eyebrow}</span>
      <h2 id={id}>{title}</h2>
      <p>{subtitle}</p>
    </div>
  )
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div className={styles.metric}><strong>{value}</strong><span>{label}</span></div>
}

function AudienceCard({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <article className={styles.audienceCard}>
      <span className={styles.audienceNumber}>{number}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      <Link href="/sign-up">Explore your path <ArrowRight aria-hidden="true" size={15} /></Link>
    </article>
  )
}
