import { NextResponse } from "next/server";
import { z } from "zod";
import { callerId } from "@/lib/caller";
import { logAi, saveNodes, loadRoadmap, serviceClient } from "@/lib/store";
import { checkAiDay } from "@/lib/rateLimit";
import { callAI } from "@/lib/nim";
import { ProjectReviewSchema, buildReviewMessages } from "@/lib/ai/projectPrompts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Body = z.object({
  roadmapId: z.string().uuid(),
  order: z.number().int().min(0),
  githubUrl: z.string().max(300).optional(),
  pasted: z.string().max(12000).optional(),
}).refine((v) => v.githubUrl || v.pasted, { message: "githubUrl or pasted required" });

function parseRepo(url: string): { owner: string; repo: string } | null {
  const m = url.trim().match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git|\/)?$/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

async function gh(path: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    return await fetch(`https://api.github.com${path}`, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/vnd.github+json",
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
    });
  } finally {
    clearTimeout(t);
  }
}

function b64(s: string): string {
  try {
    return Buffer.from(s.replace(/\n/g, ""), "base64").toString("utf-8");
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  const userKey = await callerId(req);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { roadmapId, order, githubUrl, pasted } = parsed.data;

  if (!process.env.NIM_API_KEY) {
    return NextResponse.json({ error: "nim_not_configured" }, { status: 503 });
  }
  const day = checkAiDay(userKey);
  if (!day.ok) return NextResponse.json({ error: "daily_limit" }, { status: 429 });

  const sb = serviceClient();
  const rm = await loadRoadmap(sb, roadmapId, userKey);
  if (!rm) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const idx = rm.nodes.findIndex((n) => n.order === order);
  const node = rm.nodes[idx];
  if (!node || node.type !== "project") return NextResponse.json({ error: "bad_node" }, { status: 400 });
  if (node.locked) return NextResponse.json({ error: "locked", message: "Finish the previous node first." }, { status: 403 });

  const isPaste = !githubUrl;
  let readme = "";
  let tree: string[] = [];

  if (githubUrl) {
    const repo = parseRepo(githubUrl);
    if (!repo) {
      return NextResponse.json({ error: "bad_url", message: "Use a public repo URL like https://github.com/owner/repo" }, { status: 400 });
    }
    try {
      const [rReadme, rTree] = await Promise.all([
        gh(`/repos/${repo.owner}/${repo.repo}/readme`),
        gh(`/repos/${repo.owner}/${repo.repo}/git/trees/HEAD?recursive=1`),
      ]);
      if (rReadme.status === 404 || rTree.status === 404) {
        return NextResponse.json(
          { error: "not_reachable", message: "Repo not reachable (private, renamed or empty). Make it public or use paste-mode for half XP." },
          { status: 404 },
        );
      }
      if (!rReadme.ok || !rTree.ok) throw new Error(`github_${rReadme.status}`);
      const jR = await rReadme.json().catch(() => ({}));
      readme = typeof jR.content === "string" ? b64(jR.content) : "";
      const jT = await rTree.json().catch(() => ({}));
      tree = Array.isArray(jT.tree) ? jT.tree.map((t: { path?: string }) => t.path ?? "").filter(Boolean).slice(0, 200) : [];
      if (jT.truncated) tree.push("…(truncated)");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "github_failed";
      if (/abort/i.test(msg)) {
        return NextResponse.json({ error: "github_timeout", message: "GitHub timed out (5s). Retry or paste code." }, { status: 504 });
      }
      return NextResponse.json({ error: "not_reachable", message: "Repo not reachable. Make it public or use paste-mode." }, { status: 404 });
    }
  }

  let fallbackUsed = false;
  const started = Date.now();
  try {
    const review = await callAI({
      task: "review",
      schema: ProjectReviewSchema,
      messages: buildReviewMessages({
        nodeTitle: node.title,
        nodeSummary: node.summary,
        readme,
        tree,
        pasted: pasted ?? null,
      }),
      maxTokens: 1500,
      log: (info) => {
        if (info.fallback) fallbackUsed = true;
      },
    });
    const total = review.correctness + review.structure + review.practice + review.readme;
    const pass = total >= 70;

    const submission = {
      kind: (isPaste ? "paste" : "github") as "paste" | "github",
      ...(isPaste ? {} : { url: githubUrl }),
      scores: { ...review, total } as unknown as { correctness: number; structure: number; practice: number; readme: number; total: number },
      issues: review.issues,
      suggestions: review.suggestions,
      feedback: review.feedback,
      verified: !isPaste,
      pass,
      ts: new Date().toISOString(),
    };
    const subs = [...(node.project?.submissions ?? []), submission].slice(-10);
    node.project = { submissions: subs, lastScore: total };
    node.weak = !pass;

    let unlockedNext: number | null = null;
    if (pass) {
      node.status = "done";
      const next = rm.nodes[idx + 1];
      if (next && next.locked) {
        next.locked = false;
        next.status = "open";
        unlockedNext = next.order;
      }
    }
    await saveNodes(sb, roadmapId, rm.nodes);

    // XP: full 200 GitHub / half 100 paste (plan §5); small consolation on fail
    const xpGain = pass ? (isPaste ? 100 : 200) : 10;
    try {
      await sb.from("progress_events").insert({ user_id: userKey, node_order: order, type: "project", score: total });
      const { data: u } = await sb.from("users").select("xp").eq("clerk_id", userKey).maybeSingle();
      const xp = ((u?.xp as number) ?? 0) + xpGain;
      await sb.from("users").upsert({ clerk_id: userKey, xp }, { onConflict: "clerk_id" });
    } catch { /* XP non-critical */ }

    await logAi(sb, { user_id: userKey, task: "review", provider: fallbackUsed ? "fallback" : "primary", latency_ms: Date.now() - started, fallback_used: fallbackUsed });
    return NextResponse.json({ ...submission, unlockedNext, xpGain, fallback: fallbackUsed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "nim_all_failed";
    await logAi(sb, { user_id: userKey, task: "review", provider: "none", latency_ms: Date.now() - started, fallback_used: true, error_code: msg.slice(0, 300) });
    return NextResponse.json(
      { error: "nim_all_failed", detail: msg, message: "Review engine busy (Ultra → Lightning → Glimmer failed). Retry Now." },
      { status: 502 },
    );
  }
}
