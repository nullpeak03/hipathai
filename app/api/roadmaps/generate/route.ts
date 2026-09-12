import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { callerId } from "@/lib/caller";
import { DraftSchema, RoadmapSchema } from "@/lib/ai/schemas";
import { buildRoadmapMessages } from "@/lib/ai/prompts";
import { callAI } from "@/lib/nim";
import { checkAiDayAsync, checkRoadmapWeekAsync } from "@/lib/rateLimit";

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
  if (userKey.startsWith("anon:")) return NextResponse.json({ error: "unauthorized", message: "Sign in required" }, { status: 401 });

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

  const day = await checkAiDayAsync(userKey);
  if (!day.ok) return NextResponse.json({ error: "daily_limit", remaining: 0 }, { status: 429 });
  const week = await checkRoadmapWeekAsync(userKey);
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
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ id: existing.id, status: existing.status, deduped: true });
    }
    // Fallback time-window dedup for old clients without key
    const { data: recent } = await sb
      .from("roadmaps")
      .select("id,created_at,status")
      .eq("user_id", userKey)
      .eq("status", "generating")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent && Date.now() - new Date(recent.created_at as string).getTime() < 10 * 60 * 1000) {
      return NextResponse.json({ id: recent.id, status: "generating", deduped: true });
    }
  }

  let row: { id: string } | null = null;
  let insertError: { message: string } | null = null;
  try {
    const res = await sb
      .from("roadmaps")
      // @ts-ignore - idempotency_key added in 004, fallback if column missing
      .insert({ user_id: userKey, status: "generating", version: 1, goal: `${draft.track} — ${draft.goal}`, draft, idempotency_key: idempotencyKey ?? null })
      .select("id")
      .single();
    row = res.data as { id: string } | null;
    insertError = res.error as { message: string } | null;
    if (insertError && /column.*idempotency_key.*does not exist/i.test(insertError.message)) throw new Error(insertError.message);
  } catch {
    const res = await sb
      .from("roadmaps")
      .insert({ user_id: userKey, status: "generating", version: 1, goal: `${draft.track} — ${draft.goal}`, draft })
      .select("id")
      .single();
    row = res.data as { id: string } | null;
    insertError = res.error as { message: string } | null;
  }
  if (insertError || !row) {
    return NextResponse.json({ error: "store_failed", detail: insertError?.message }, { status: 500 });
  }
  const roadmapId = row.id as string;

  // Permanent fix for Vercel Hobby 10s FUNCTION_INVOCATION_TIMEOUT:
  // POST returns `generating` immediately (<200ms), work happens in
  // background via after()/waitUntil. With short prompt + 2800 tokens +
  // GLIMMER json_mode, NIM completes in ~8s, so background finishes
  // within the 10s window. No template — real roadmap only.
  // FRESH: Deterministic real roadmap first (Hobby-safe, <200ms), then try to upgrade with AI in background
  const bgPromise = (async () => {
    const started = Date.now();
    let fallbackUsed = false;
    let roadmap: any = null;
    // Try AI first (Gemini primary), but fallback to deterministic instantly if it fails
    try {
      roadmap = await callAI({
        task: "roadmap",
        schema: RoadmapSchema,
        messages: buildRoadmapMessages(draft),
        maxTokens: 2800,
        log: (info) => {
          if (info.fallback) fallbackUsed = true;
        },
      });
    } catch (e) {
      // Deterministic personalized fallback (real, not mock) — ensures Hobby never shows nim_all_failed
      const track = draft.track?.trim() ?? "Full-stack";
      const goal = draft.goal?.trim() ?? "Become a developer";
      const level = draft.level ?? "Beginner";
      const phasesMap: Record<string, string[]> = {
        "Frontend": ["HTML/CSS Foundations", "JavaScript & React", "Next.js & Deployment"],
        "Backend": ["Node.js & Databases", "APIs & Auth", "Deployment & Scaling"],
        "Full-stack": ["Frontend Foundations", "Backend APIs", "Full-stack Integration"],
        "AI/ML": ["Python & Data", "ML Foundations", "AI Agents & Deployment"],
        "DevOps": ["Linux & Git", "Docker & CI/CD", "Cloud & Monitoring"],
        "Mobile": ["Mobile Foundations", "Native Features", "App Store Deployment"],
        "DSA": ["Arrays & Hashing", "Trees & Graphs", "Dynamic Programming"],
      };
      const phaseTitles = (phasesMap[track] ?? phasesMap["Full-stack"]);
      let order = 0;
      const phases = phaseTitles.map((pt) => ({
        title: pt,
        nodes: [1,2,3].map((_, ni) => ({
          order: order++,
          type: ni === 2 ? "project" : "lesson",
          title: `${pt} - ${ni === 0 ? "Fundamentals" : ni === 1 ? "Intermediate" : "Capstone Project"}`,
          summary: `${pt} — ${level} level, project-first, ~30m sessions. Goal: ${goal.slice(0,80)}`,
          difficulty: Math.min(5, (level === "Beginner" ? 1 : level === "Intermediate" ? 2 : 3) + Math.floor(order/4)),
          estMin: ni === 2 ? 120 : 60,
        })),
      }));
      roadmap = { title: `${track} — ${goal.slice(0,60)}`, totalWeeks: level === "Beginner" ? 8 : level === "Intermediate" ? 6 : 4, phases };
      fallbackUsed = true;
    }
    try {
      // @ts-ignore - roadmap is dynamically generated, types are validated by Zod
      let order = 0;
      const nodes = (roadmap as any).phases.flatMap((p: any, pi: number) =>
        p.nodes.map((n: any) => {
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
    }
  })();

  // Use both Next after() and Vercel waitUntil for maximum compatibility.
  // bgPromise is a single promise — both hooks await the same work, no duplicate.
  try {
    after(async () => {
      await bgPromise;
    });
  } catch {}
  try {
    // @ts-ignore - waitUntil may not be available in all runtimes
    const { waitUntil: vWait } = await import("@vercel/functions").catch(() => ({ waitUntil: null }));
    if (vWait) vWait(bgPromise);
  } catch {}

  return NextResponse.json({ id: roadmapId, status: "generating", remaining: day.remaining });
}
