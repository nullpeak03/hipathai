import { NextResponse } from "next/server";
import { z } from "zod";
import { callerId } from "@/lib/caller";
import { DraftSchema, RoadmapSchema } from "@/lib/ai/schemas";
import { buildRoadmapMessages } from "@/lib/ai/prompts";
import { callAI } from "@/lib/nim";
import { checkAiDay, checkRoadmapWeek } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  draft: DraftSchema,
  idempotencyKey: z.string().max(80).optional(),
});

function hasSupabase() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function POST(req: Request) {
  const userKey = await callerId(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_draft", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { draft, idempotencyKey } = parsed.data;

  const day = checkAiDay(userKey);
  if (!day.ok) return NextResponse.json({ error: "daily_limit", remaining: 0 }, { status: 429 });
  const week = checkRoadmapWeek(userKey);
  if (!week.ok) return NextResponse.json({ error: "weekly_limit", remaining: 0 }, { status: 429 });

  if (!process.env.NIM_API_KEY) {
    return NextResponse.json(
      { error: "nim_not_configured", message: "NIM_API_KEY missing on server." },
      { status: 503 },
    );
  }

  if (!hasSupabase()) {
    return NextResponse.json(
      { error: "no_store", message: "Supabase not configured." },
      { status: 503 },
    );
  }

  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  await sb.from("users").upsert({ clerk_id: userKey }, { onConflict: "clerk_id" });

  if (idempotencyKey) {
    const { data: existing } = await sb
      .from("roadmaps")
      .select("id,created_at,status")
      .eq("user_id", userKey)
      .eq("status", "generating")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing && Date.now() - new Date(existing.created_at as string).getTime() < 10 * 60 * 1000) {
      return NextResponse.json({ id: existing.id, status: "generating", deduped: true });
    }
  }

  const { data: row, error: insertError } = await sb
    .from("roadmaps")
    .insert({ user_id: userKey, status: "generating", version: 1, goal: `${draft.track} — ${draft.goal}`, draft })
    .select("id")
    .single();
  if (insertError || !row) {
    return NextResponse.json({ error: "store_failed", detail: insertError?.message }, { status: 500 });
  }
  const roadmapId = row.id as string;

  // Real roadmap only — no template. Primary is GLIMMER (see lib/nim.ts) with
  // 15s task timeout and 1800 tokens, measured ~9.6s for full prompt on 2026-09-09.
  // On Vercel Hobby 10s limit this is tight but succeeds; on Pro 60s it always succeeds.
  // We keep the request synchronous (no after()) so the generating page polls
  // and sees `ready` after ~10s instead of hanging forever. No fake fallback.
  const started = Date.now();
  let fallbackUsed = false;
  try {
    const roadmap = await callAI({
      task: "roadmap",
      schema: RoadmapSchema,
      messages: buildRoadmapMessages(draft),
      maxTokens: 2800,
      log: (info) => {
        if (info.fallback) fallbackUsed = true;
      },
    });

    let order = 0;
    const nodes = roadmap.phases.flatMap((p, pi) =>
      p.nodes.map((n) => {
        const { order: _aiOrder, ...rest } = n;
        const o = order++;
        return {
          order: o,
          phase: p.title,
          phaseIndex: pi,
          ...rest,
          locked: o !== 0,
          status: o === 0 ? "open" : "locked",
          weak: false,
        };
      }),
    );

    await sb.from("roadmaps").update({
      status: "ready",
      nodes,
      title: roadmap.title,
      total_weeks: roadmap.totalWeeks,
    }).eq("id", roadmapId);

    await sb
      .from("roadmaps")
      .update({ status: "archived" })
      .eq("user_id", userKey)
      .eq("status", "ready")
      .neq("id", roadmapId);

    await sb.from("ai_logs").insert({
      user_id: userKey,
      task: "roadmap",
      provider: fallbackUsed ? "fallback" : "primary",
      latency_ms: Date.now() - started,
      fallback_used: fallbackUsed,
    });

    return NextResponse.json({ id: roadmapId, status: "ready", remaining: day.remaining, fallback: fallbackUsed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "nim_all_failed";
    await sb.from("roadmaps").update({ status: "failed" }).eq("id", roadmapId);
    await sb.from("ai_logs").insert({
      user_id: userKey,
      task: "roadmap",
      provider: "none",
      latency_ms: Date.now() - started,
      fallback_used: true,
      error_code: msg.slice(0, 300),
    });
    // Return failed so UI shows error card + Retry Now (same id) + Back to Summary — no template
    return NextResponse.json({ id: roadmapId, status: "failed", error: "nim_all_failed", detail: msg.slice(0, 300) }, { status: 200 });
  }
}
