// llms.txt — machine-readable product card for AI crawlers and assistants
// (GEO: the file LLM tools prefer over HTML). Plain text, stable URLs.

const BODY = `# HiPath AI

> Your Personal AI Learning Navigator — a free app that turns any computer
> science goal into a week-by-week roadmap, teaches every lesson with an AI
> tutor, verifies mastery with adaptive quizzes, and keeps streaks alive.

## What it does

- Adaptive Roadmaps: goal + level + schedule become phased, lesson-sized plans.
- AI Lessons: structured lessons with runnable code examples (Python, JavaScript, AI agents, and more).
- Smart Quizzes: banks sized to each lesson; 60% to unlock the next lesson; fresh questions on retake.
- Persistent Tutor: remembers roadmap progress, current lesson, and weak topics.
- Analytics: streaks, XP, levels, study heatmap, community benchmarks.
- Installable PWA with offline access to cached lessons.

## Who it is for

Self-taught programmers, CS students, and career switchers learning Python,
JavaScript, TypeScript, data structures, machine learning, AI agents, DevOps,
SQL, and web development.

## Pricing

Free (V1). No credit card required.

## Docs

- [Home](https://www.hipathai.me/): landing page and product overview.
- [Roadmap library](https://www.hipathai.me/roadmaps): free week-by-week coding roadmaps (Python, JavaScript, DSA, AI agents, ML and more).
- [About](https://www.hipathai.me/about): what HiPath AI is, how it works, and the tech behind it.
- [Sign up](https://www.hipathai.me/sign-up): create a free account.
- [Changelog](https://www.hipathai.me/changelog): what shipped recently.
- [Product roadmap](https://www.hipathai.me/product-roadmap): what ships next.

## Optional

- [Privacy Policy](https://www.hipathai.me/privacy): data collection, subprocessors, rights, deletion.
- [Terms of Service](https://www.hipathai.me/terms): acceptable use, AI-content disclaimer, liability.
- [Contact](https://www.hipathai.me/contact): support and privacy requests.

## FAQ

Q: Is HiPath AI really free?
A: Yes, V1 is completely free with no credit card.

Q: What can I learn?
A: Anything in CS and technology — type any goal and the AI builds your path.

Q: How do quizzes work?
A: Every lesson ends with an AI-generated quiz; score 60%+ to unlock the next lesson.

Q: Does the tutor know my progress?
A: Yes — roadmap, current lesson, and weak areas shape every answer.
`

export async function GET(): Promise<Response> {
  return new Response(BODY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
