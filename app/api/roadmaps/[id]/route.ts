import { NextResponse } from "next/server";
import { callerId } from "@/lib/caller";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "no_store" }, { status: 404 });
  }
  const userKey = await callerId(req);
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data, error } = await sb
    .from("roadmaps")
    .select("id,status,version,title,nodes,goal,created_at,draft")
    .eq("id", id)
    .eq("user_id", userKey)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "store_failed", detail: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (data.status !== "ready") {
    // Heal stuck `generating` rows (Vercel Hobby timeout: after() never ran).
    // If older than 20s, build a template roadmap instantly so polling never
    // hangs forever (fixes the "timing out all the time" report).
    const ageMs = Date.now() - new Date((data as unknown as { created_at: string }).created_at).getTime();
    if (data.status === "generating" && ageMs > 20000) {
      try {
        const { DraftSchema } = await import("@/lib/ai/schemas");
        const { generateTemplateRoadmap } = await import("@/lib/ai/template");
        const parsed = DraftSchema.safeParse((data as unknown as { draft: unknown }).draft);
        if (parsed.success) {
          let order = 0;
          const tpl = generateTemplateRoadmap(parsed.data);
          const nodes = tpl.phases.flatMap((p, pi) =>
            p.nodes.map((n) => {
              const { order: _o, ...rest } = n;
              const o = order++;
              return { order: o, phase: p.title, phaseIndex: pi, ...rest, locked: o !== 0, status: o === 0 ? "open" : "locked", weak: false };
            }),
          );
          await sb.from("roadmaps").update({ status: "ready", nodes, title: tpl.title, total_weeks: tpl.totalWeeks }).eq("id", id);
          await sb.from("ai_logs").insert({ user_id: userKey, task: "roadmap", provider: "template_heal", latency_ms: ageMs, fallback_used: true });
          return NextResponse.json({ id: data.id, status: "ready", title: tpl.title, nodes, goal: data.goal, healed: true });
        }
      } catch {
        // heal failed — return original generating status
      }
    }
    return NextResponse.json({ id: data.id, status: data.status });
  }
  return NextResponse.json(data);
}
