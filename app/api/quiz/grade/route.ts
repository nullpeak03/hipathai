import { NextResponse } from "next/server";
import { z } from "zod";
import { callerId } from "@/lib/caller";
import { saveNodes, loadRoadmap, serviceClient } from "@/lib/store";

export const dynamic = "force-dynamic";

const Body = z.object({
  roadmapId: z.string().uuid(),
  order: z.number().int().min(0),
  answers: z.array(z.union([z.number().int(), z.string().max(300)])).min(1).max(8),
});

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export async function POST(req: Request) {
  const userKey = await callerId(req);
  if (userKey.startsWith("anon:")) return NextResponse.json({ error: "unauthorized", message: "Sign in required" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { roadmapId, order, answers } = parsed.data;

  const sb = serviceClient();
  const rm = await loadRoadmap(sb, roadmapId, userKey);
  if (!rm) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const idx = rm.nodes.findIndex((n) => n.order === order);
  const node = rm.nodes[idx];
  if (!node || node.type !== "lesson" || !node.quiz) {
    return NextResponse.json({ error: "no_quiz", message: "Generate the quiz first." }, { status: 400 });
  }
  const stored = node.quiz.questions as {
    q: string; type: string; options?: string[]; answerIndex?: number; answerText?: string; explanation: string;
  }[];
  if (answers.length !== stored.length) {
    return NextResponse.json({ error: "answer_count", message: `Expected ${stored.length} answers.` }, { status: 400 });
  }

  let correct = 0;
  const results = stored.map((q, i) => {
    const a = answers[i];
    let ok = false;
    if (q.type === "mcq") {
      ok = typeof a === "number" && a === q.answerIndex;
    } else {
      ok = typeof a === "string" && q.answerText !== undefined && norm(a) === norm(q.answerText);
    }
    if (ok) correct += 1;
    return { index: i, correct: ok, explanation: q.explanation };
  });

  const score = Math.round((correct / stored.length) * 100);
  const pass = score >= 70;
  const attempts = (node.quiz.attempts ?? 0) + 1;
  node.quiz = { questions: stored, attempts, lastScore: score };
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

  try {
    await sb.from("progress_events").insert({ user_id: userKey, node_order: order, type: "quiz", score });
    const { data: u } = await sb.from("users").select("xp").eq("clerk_id", userKey).maybeSingle();
    const xp = ((u?.xp as number) ?? 0) + (pass ? 100 : 10);
    await sb.from("users").upsert({ clerk_id: userKey, xp }, { onConflict: "clerk_id" });
  } catch { /* XP non-critical */ }

  return NextResponse.json({
    score, pass, correct, total: stored.length, results, weak: node.weak, unlockedNext, attempts,
  });
}
