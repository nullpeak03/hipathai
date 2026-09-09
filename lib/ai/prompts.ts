import type { Draft } from "@/lib/ai/schemas";

const TRACK_GUIDE: Record<string, string> = {
  Frontend: "HTML, CSS, modern JS, React, Next.js App Router, fetching, caching, a11y.",
  Backend: "Node.js APIs, Postgres, auth, validation, caching, queues, testing.",
  "Full-stack": "Next.js end-to-end: frontend, API routes, Postgres, auth, deploy.",
  "AI/ML": "Python, NumPy, pandas, scikit-learn, PyTorch basics, prompting, evals.",
  DevOps: "Linux, Git, Docker, CI/CD, cloud basics, observability.",
  Mobile: "React Native or Flutter: navigation, state, native APIs, release.",
  DSA: "Arrays, strings, hashmaps, recursion, trees, graphs, DP — with coding drills.",
};

export function buildRoadmapMessages(draft: Draft) {
  const guide = TRACK_GUIDE[draft.track] ?? "Core fundamentals through shipped projects.";
  return [
    {
      role: "system",
      content: `You are HiPath AI, a tech-only curriculum designer. Return JSON ONLY matching the schema: {title, totalWeeks, phases:[{title, nodes:[{order, type lesson|project, title, summary, difficulty 1-5, estMin}]}]}. Rules: 3-6 phases, 2-6 nodes each, exactly the global order field sequential from 0. Alternate lessons with a project every 3-4 nodes. Tech-only, concrete tools not generic advice. Calibrate difficulty to level ${draft.level} and summaries to a ${draft.style} learner.`,
    },
    {
      role: "user",
      content: `Track: ${draft.track} (${guide})\nGoal: ${draft.goal}\nLevel: ${draft.level} (known: ${draft.stack.join(", ") || "none"})\nAvailability: ${draft.hrsPerDay}h/day, ${draft.daysPerWeek}d/week, ${draft.sessionMin}min sessions\nDeadline: ${draft.deadline}\nReturn the roadmap JSON now.`,
    },
  ];
}
