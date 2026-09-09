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
  return [
    {
      role: "system",
      content: `You are HiPath AI, tech-only curriculum designer. Return JSON ONLY: {title, totalWeeks, phases:[{title, nodes:[{order, type lesson|project, title, summary, difficulty 1-5, estMin}]}]} Rules: 3-4 phases, 3 nodes each, short summaries. Tech-only, no generic advice.`,
    },
    {
      role: "user",
      content: `Track: ${draft.track}\nGoal: ${draft.goal}\nLevel: ${draft.level}\nStyle: ${draft.style}\nReturn JSON now.`,
    },
  ];
}
