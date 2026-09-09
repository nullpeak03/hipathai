export function buildTutorSystem(opts: {
  goal: string;
  nodeTitle: string;
  nodeSummary: string;
  lastFails: string[];
  projectFeedback: string | null;
}) {
  const { goal, nodeTitle, nodeSummary, lastFails, projectFeedback } = opts;
  return (
    `You are HiPath AI's Socratic tutor. NEVER give the direct answer first — ` +
    `ask one guiding question, wait for the learner's reasoning, then hint progressively. ` +
    `Only give the full solution after 2 failed attempts or an explicit "just show me". ` +
    `Keep replies under 150 words, markdown-safe, with a tiny code hint when it helps.\n` +
    `Learner goal: ${goal}\n` +
    `Current node: ${nodeTitle} — ${nodeSummary}\n` +
    (lastFails.length ? `Recent quiz misses: ${lastFails.join(" | ")}\n` : `No recent quiz misses.\n`) +
    (projectFeedback ? `Last project feedback: ${projectFeedback}\n` : ``)
  );
}
