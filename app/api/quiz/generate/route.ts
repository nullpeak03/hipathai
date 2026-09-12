import { NextResponse } from "next/server";
import { z } from "zod";
import { callerId } from "@/lib/caller";
import { logAi, saveNodes, loadRoadmap, serviceClient } from "@/lib/store";
import { checkAiDayAsync } from "@/lib/rateLimit";
import { callAI } from "@/lib/nim";
import { QuizSchema } from "@/lib/ai/lessonSchemas";
import { buildQuizMessages } from "@/lib/ai/lessonPrompts";
import { DraftSchema } from "@/lib/ai/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({ roadmapId: z.string().uuid(), order: z.number().int().min(0) });

export async function POST(req: Request) {
  const userKey = await callerId(req);
  if (userKey.startsWith("anon:")) return NextResponse.json({ error: "unauthorized", message: "Sign in required" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { roadmapId, order } = parsed.data;

  if (!process.env.NIM_API_KEY) {
    return NextResponse.json({ error: "nim_not_configured", message: "Add NIM_API_KEY and retry." }, { status: 503 });
  }
  const day = await checkAiDayAsync(userKey);
  if (!day.ok) return NextResponse.json({ error: "daily_limit" }, { status: 429 });

  const sb = serviceClient();
  const rm = await loadRoadmap(sb, roadmapId, userKey);
  if (!rm) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const node = rm.nodes.find((n) => n.order === order);
  if (!node || node.type !== "lesson") return NextResponse.json({ error: "bad_node" }, { status: 400 });
  if (node.locked) return NextResponse.json({ error: "locked" }, { status: 403 });

  // Adaptive difficulty: average of recent quiz scores on this node
  const attempts = node.quiz?.attempts ?? 0;
  let avgScore: number | null = node.quiz?.lastScore ?? null;
  try {
    const { data } = await sb
      .from("progress_events")
      .select("score")
      .eq("user_id", userKey)
      .eq("node_order", order)
      .eq("type", "quiz")
      .order("ts", { ascending: false })
      .limit(5);
    if (data && data.length > 0) {
      avgScore = Math.round(data.reduce((a, r) => a + (r.score ?? 0), 0) / data.length);
    }
  } catch { /* adaptive degrades to lastScore */ }

  const draft = DraftSchema.safeParse(rm.draft);
  if (!draft.success) return NextResponse.json({ error: "bad_draft" }, { status: 500 });

  const lessonPoints =
    (node.lesson as { keyPoints?: string[] } | null)?.keyPoints ?? [node.summary];

  let fallbackUsed = false;
  const started = Date.now();
  try {
    const quiz = await callAI({
      task: "quiz",
      schema: QuizSchema,
      messages: buildQuizMessages({
        draft: draft.data,
        nodeTitle: node.title,
        lessonPoints,
        avgScore,
        attempts,
      }),
      maxTokens: 1500,
      log: (info) => {
        if (info.fallback) fallbackUsed = true;
      },
    });

    node.quiz = { questions: quiz.questions, attempts, lastScore: node.quiz?.lastScore ?? null };
    await saveNodes(sb, roadmapId, rm.nodes);
    await logAi(sb, { user_id: userKey, task: "quiz", provider: fallbackUsed ? "fallback" : "primary", latency_ms: Date.now() - started, fallback_used: fallbackUsed });

    // Sanitize: answers stay server-side until grade
    const publicQs = quiz.questions.map((q, i) => ({
      index: i,
      q: q.q,
      type: q.type,
      options: q.options ?? null,
    }));
    return NextResponse.json({ questions: publicQs, total: publicQs.length, attempts, avgScore, fallback: fallbackUsed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "nim_all_failed";
    return NextResponse.json(
      { error: "nim_all_failed", detail: msg, message: "Quiz engine busy. Retry Now." },
      { status: 502 },
    );
  }
}
