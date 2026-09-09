import type { Draft } from "@/lib/ai/schemas";
import type { Roadmap } from "@/lib/ai/schemas";

// Deterministic template that never calls NIM — completes in <1ms.
// Used as fallback when NIM times out on Vercel Hobby (10s limit) and to
// heal stuck `generating` rows. Still respects plan.md progression:
// gated, only nodes[0] unlocked, quiz >=70% unlocks next.

const TRACK_PHASES: Record<string, { title: string; lessons: string[] }[]> = {
  Frontend: [
    { title: "Foundations", lessons: ["HTML Semantics & Accessibility", "CSS Layout & Responsive Design", "Modern JavaScript Essentials", "Git & Dev Workflow"] },
    { title: "React Core", lessons: ["React Components & State", "Hooks Deep-Dive", "Next.js App Router & Fetching"] },
    { title: "Styling & Performance", lessons: ["Tailwind & Design Systems", "Image, Font & Caching"] },
    { title: "Ship", lessons: ["Portfolio Project & Deploy"] },
  ],
  Backend: [
    { title: "API Foundations", lessons: ["Node.js & Express Basics", "Postgres & Prisma", "Auth & Validation"] },
    { title: "Production APIs", lessons: ["Caching & Queues", "Testing & Observability"] },
    { title: "Ship", lessons: ["Deploy & Project Review"] },
  ],
  "Full-stack": [
    { title: "Foundations", lessons: ["HTML/CSS/JS & Git", "TypeScript Essentials"] },
    { title: "Frontend", lessons: ["React & Next.js App Router", "Data Fetching & Caching"] },
    { title: "Backend", lessons: ["Postgres & Auth", "API Routes & Validation"] },
    { title: "Ship", lessons: ["Full-stack Project & Deploy"] },
  ],
  "AI/ML": [
    { title: "Python Foundations", lessons: ["Python & NumPy", "Pandas & Data Wrangling"] },
    { title: "ML Core", lessons: ["Scikit-learn & Evaluation", "PyTorch Basics"] },
    { title: "LLM Apps", lessons: ["Prompting & RAG", "Evals & Deploy"] },
  ],
  DevOps: [
    { title: "Linux & Git", lessons: ["Linux Essentials", "Git & GitHub Flow"] },
    { title: "Containers", lessons: ["Docker & Compose", "CI/CD with GitHub Actions"] },
    { title: "Cloud", lessons: ["Cloud Deploy & Observability"] },
  ],
  Mobile: [
    { title: "Mobile Foundations", lessons: ["React Native Setup", "Navigation & State"] },
    { title: "Native APIs", lessons: ["Device APIs & Release"] },
  ],
  DSA: [
    { title: "Arrays & Hashing", lessons: ["Arrays, Strings & Hashmaps", "Two Pointers & Sliding Window"] },
    { title: "Recursion & Graphs", lessons: ["Recursion & Trees", "Graphs & BFS/DFS", "DP Foundations"] },
  ],
};

const GENERIC = [
  { title: "Foundations", lessons: ["Core Concepts & Setup", "Essential Tools"] },
  { title: "Core Skills", lessons: ["Intermediate Patterns", "Hands-on Practice"] },
  { title: "Ship", lessons: ["Capstone Project & Review"] },
];

function difficultyFor(level: Draft["level"], index: number): number {
  const base = level === "Beginner" ? 1 : level === "Intermediate" ? 2 : 3;
  return Math.min(5, base + Math.floor(index / 4));
}

export function generateTemplateRoadmap(draft: Draft): Roadmap {
  const phasesDef = TRACK_PHASES[draft.track] ?? GENERIC;
  const totalWeeks =
    draft.level === "Beginner" ? 8 : draft.level === "Intermediate" ? 6 : 4;

  let order = 0;
  const phases = phasesDef.map((phase) => {
    const nodes = phase.lessons.flatMap((lesson, li) => {
      const isLast = li === phase.lessons.length - 1;
      const lessonNode = {
        order: order++,
        type: "lesson" as const,
        title: lesson,
        summary: `${lesson} — ${draft.style} focused, calibrated for ${draft.level.toLowerCase()} · ~${draft.sessionMin}m sessions.`,
        difficulty: difficultyFor(draft.level, order),
        estMin: draft.sessionMin,
      };
      // Every 3-4 lessons, inject a project (plan §5)
      if (isLast && order % 3 === 0) {
        const projectNode = {
          order: order++,
          type: "project" as const,
          title: `${phase.title} Mini-Project`,
          summary: `Apply ${lesson} in a shippable mini-project. Push to GitHub for AI rubric review.`,
          difficulty: difficultyFor(draft.level, order),
          estMin: draft.sessionMin * 2,
        };
        return [lessonNode, projectNode];
      }
      return [lessonNode];
    });
    return { title: phase.title, nodes };
  });

  // Ensure 1 project at the end if none yet
  const hasProject = phases.some((p) => p.nodes.some((n) => n.type === "project"));
  if (!hasProject) {
    const last = phases[phases.length - 1];
    last.nodes.push({
      order: order++,
      type: "project",
      title: `${draft.track} Capstone`,
      summary: `End-to-end ${draft.goal} — ship a public repo for full XP.`,
      difficulty: difficultyFor(draft.level, order),
      estMin: draft.sessionMin * 3,
    });
  }

  return {
    title: `${draft.track} — ${draft.goal.slice(0, 60)}`,
    totalWeeks,
    phases,
  };
}
