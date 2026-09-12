import { NextResponse } from "next/server";
import { z } from "zod";
import { callerId } from "@/lib/caller";
import { logAi, saveNodes, loadRoadmap, serviceClient } from "@/lib/store";
import { checkAiDayAsync } from "@/lib/rateLimit";
import { callAI } from "@/lib/nim";
import { LessonSchema } from "@/lib/ai/lessonSchemas";
import { buildLessonMessages } from "@/lib/ai/lessonPrompts";
import { DraftSchema } from "@/lib/ai/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({ roadmapId: z.string().uuid(), order: z.number().int().min(0) });

async function videoOk(videoId: string): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`, { signal: ctrl.signal });
    if (!r.ok) return false;
    const j = await r.json();
    return Boolean(j.title && !j.error);
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

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
  if (node.locked) return NextResponse.json({ error: "locked", message: "Pass the previous quiz to unlock." }, { status: 403 });
  if (node.lesson) return NextResponse.json({ lesson: node.lesson, cached: true, fallback: false });

  const draft = DraftSchema.safeParse(rm.draft);
  if (!draft.success) return NextResponse.json({ error: "bad_draft" }, { status: 500 });

  let fallbackUsed = false;
  const started = Date.now();
  try {
    const prevTitles = rm.nodes.filter((n) => n.order < order).map((n) => n.title);
    const lesson = await callAI({
      task: "lesson",
      schema: LessonSchema,
      messages: buildLessonMessages({
        draft: draft.data,
        nodeTitle: node.title,
        nodeSummary: node.summary,
        prevTitles,
      }),
      maxTokens: 3000,
      log: (info) => {
        if (info.fallback) fallbackUsed = true;
      },
    });

    // Validate AI-suggested videos in parallel (was sequential 4×6s = 24s, now ~6s)
    const checks = await Promise.all(lesson.videos.slice(0, 4).map(async (v) => ((await videoOk(v.videoId)) ? v : null)));
    const kept = checks.filter(Boolean) as typeof lesson.videos;

    const finalLesson = { ...lesson, videos: kept };
    node.lesson = finalLesson as unknown as Record<string, unknown>;
    await saveNodes(sb, roadmapId, rm.nodes);
    await logAi(sb, { user_id: userKey, task: "lesson", provider: fallbackUsed ? "fallback" : "primary", latency_ms: Date.now() - started, fallback_used: fallbackUsed });
    return NextResponse.json({ lesson: finalLesson, fallback: fallbackUsed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "nim_all_failed";
    await logAi(sb, { user_id: userKey, task: "lesson", provider: "none", latency_ms: Date.now() - started, fallback_used: true, error_code: msg.slice(0, 300) });
    return NextResponse.json(
      { error: "nim_all_failed", detail: msg, message: "All models busy (Ultra → Lightning → Glimmer failed). Retry Now." },
      { status: 502 },
    );
  }
}
