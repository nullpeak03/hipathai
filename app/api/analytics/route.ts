import { NextResponse } from "next/server";
import { callerId } from "@/lib/caller";
import { serviceClient } from "@/lib/store";

export const dynamic = "force-dynamic";

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function streakOf(days: string[]): number {
  const set = new Set(days);
  let s = 0;
  const cur = new Date();
  if (!set.has(dayKey(cur))) cur.setDate(cur.getDate() - 1);
  while (set.has(dayKey(cur))) {
    s += 1;
    cur.setDate(cur.getDate() - 1);
  }
  return s;
}

// Analytics aggregates (plan §5): streak, XP, quiz avg, completion %,
// skill heatmap, fallback transparency. Adapt rule evaluated here and
// applied via POST (missed 3d or 2 fails -> ease next node).
export async function GET(req: Request) {
  const userKey = await callerId(req);
  const sb = serviceClient();
  try {
    const [{ data: user }, { data: events }, { data: roadmaps }, { data: logs }] = await Promise.all([
      sb.from("users").select("xp,streak").eq("clerk_id", userKey).maybeSingle(),
      sb.from("progress_events").select("type,score,ts,node_order").eq("user_id", userKey).order("ts", { ascending: false }).limit(100),
      sb.from("roadmaps").select("id,title,nodes").eq("user_id", userKey).eq("status", "ready").order("created_at", { ascending: false }).limit(1),
      sb.from("ai_logs").select("task,provider,fallback_used,ts").eq("user_id", userKey).order("ts", { ascending: false }).limit(50),
    ]);

    const ev = events ?? [];
    const quizzes = ev.filter((e) => e.type === "quiz" && typeof e.score === "number");
    const quizAvg = quizzes.length ? Math.round(quizzes.reduce((a, e) => a + (e.score as number), 0) / quizzes.length) : null;

    const rm = (roadmaps ?? [])[0] as { id: string; title: string; nodes: { order: number; title: string; status: string; weak: boolean; difficulty: number; type: string }[] } | undefined;
    const nodes = rm?.nodes ?? [];
    const done = nodes.filter((n) => n.status === "done").length;
    const completion = nodes.length ? Math.round((done / nodes.length) * 100) : 0;
    const weakNodes = nodes.filter((n) => n.weak).map((n) => ({ order: n.order, title: n.title }));

    const activeDays = [...new Set(ev.map((e) => String(e.ts).slice(0, 10)))];
    const streak = streakOf(activeDays);
    const hrs = Math.round((ev.length * 30) / 60);

    const logList = logs ?? [];
    const fallbackRate = logList.length ? Math.round((logList.filter((l) => l.fallback_used).length / logList.length) * 100) : 0;

    // Adapt rule (Lightning rule, no AI): missed 3d OR 2 consecutive quiz fails
    const lastTs = ev[0]?.ts ? new Date(ev[0].ts as string).getTime() : null;
    const missed3d = lastTs === null ? false : Date.now() - lastTs > 3 * 24 * 3600 * 1000;
    const recentQuiz = quizzes.slice(0, 2);
    const twoFails = recentQuiz.length === 2 && recentQuiz.every((q) => (q.score as number) < 70);
    const adapt =
      missed3d || twoFails
        ? {
            triggered: true,
            reason: missed3d ? "No activity for 3+ days" : "Last 2 quizzes below 70%",
            action: "Ease the next locked node (difficulty −1) and surface a remedial nudge",
          }
        : { triggered: false, reason: null as string | null, action: null as string | null };

    return NextResponse.json({
      xp: (user?.xp as number) ?? 0,
      streak,
      hrs,
      quizAvg,
      completion,
      done,
      total: nodes.length,
      roadmapId: rm?.id ?? null,
      roadmapTitle: rm?.title ?? null,
      heatmap: nodes.map((n) => ({ order: n.order, title: n.title, status: n.status, weak: n.weak, difficulty: n.difficulty, type: n.type })),
      weakNodes,
      fallbackRate,
      logs: logList.slice(0, 20),
      adapt,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}

// Apply the adapt rule: difficulty −1 on the next locked node (min 1).
export async function POST(req: Request) {
  const userKey = await callerId(req);
  const sb = serviceClient();
  try {
    const { data: rm } = await sb
      .from("roadmaps")
      .select("id,nodes")
      .eq("user_id", userKey)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!rm) return NextResponse.json({ error: "no_roadmap" }, { status: 404 });
    const nodes = (rm.nodes as { order: number; locked: boolean; difficulty: number; title: string }[]) ?? [];
    const next = nodes.find((n) => n.locked);
    if (!next) return NextResponse.json({ ok: true, message: "Nothing locked — path complete." });
    next.difficulty = Math.max(1, (next.difficulty ?? 3) - 1);
    const { error } = await sb.from("roadmaps").update({ nodes }).eq("id", rm.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, message: `Eased “${next.title}” to Lv${next.difficulty}.`, order: next.order });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
