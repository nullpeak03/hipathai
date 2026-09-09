import { z } from "zod";

export const ProjectReviewSchema = z.object({
  correctness: z.number().int().min(0).max(40),
  structure: z.number().int().min(0).max(25),
  practice: z.number().int().min(0).max(20),
  readme: z.number().int().min(0).max(15),
  issues: z.array(z.string().max(200)).max(8).default([]),
  suggestions: z.array(z.string().max(200)).max(8).default([]),
  feedback: z.string().min(20).max(1500),
});

export type ProjectReview = z.infer<typeof ProjectReviewSchema>;

export function buildReviewMessages(opts: {
  nodeTitle: string;
  nodeSummary: string;
  readme: string;
  tree: string[];
  pasted: string | null;
}) {
  const { nodeTitle, nodeSummary, readme, tree, pasted } = opts;
  const evidence = pasted
    ? `PASTED CODE (unverified, no repo access):\n${pasted.slice(0, 6000)}`
    : `README (first 4k chars):\n${readme.slice(0, 4000)}\n\nFILE TREE (first 80):\n${tree.slice(0, 80).join("\n")}`;
  return [
    {
      role: "system",
      content: `You are HiPath AI's project reviewer. Return JSON ONLY: {correctness 0-40, structure 0-25, practice 0-20, readme 0-15, issues[≤8], suggestions[≤8], feedback (2-4 sentences, specific)}. Judge whether the work meets the brief; be strict but fair. Pasted-code submissions are unverified — cap correctness at 25. No execution, static review only.`,
    },
    {
      role: "user",
      content: `Project brief: ${nodeTitle} — ${nodeSummary}\n\n${evidence}\n\nReview now.`,
    },
  ];
}
