import { z } from "zod";
import { callerId } from "@/lib/caller";
import { loadRoadmap, serviceClient, logAi } from "@/lib/store";
import { checkTutorDay, checkAiDay } from "@/lib/rateLimit";
import { buildTutorSystem } from "@/lib/ai/tutorPrompts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Body = z.object({
  roadmapId: z.string().uuid(),
  order: z.number().int().min(0),
  message: z.string().min(1).max(2000),
});

function slotModel(slot: "ULTRA" | "LIGHTNING") {
  return slot === "ULTRA" ? process.env.NIM_ULTRA_ID! : process.env.NIM_LIGHTNING_ID!;
}

async function streamNIM(
  model: string,
  messages: { role: string; content: string }[],
  onToken: (t: string) => void,
  timeoutMs: number,
): Promise<void> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${process.env.NIM_BASE_URL ?? "https://integrate.api.nvidia.com/v1"}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NIM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, messages, max_tokens: 1000, temperature: 0.5, stream: true }),
        signal: ctrl.signal,
      },
    );
    if (!res.ok || !res.body) throw new Error(`nim_${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let got = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith("data:")) continue;
        const payload = s.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const j = JSON.parse(payload);
          const tok: string =
            j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content ?? "";
          if (tok) {
            got = true;
            onToken(tok);
          }
        } catch { /* keep-alive */ }
      }
    }
    if (!got) throw new Error("nim_empty");
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request) {
  const userKey = await callerId(req);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "bad_request" }), { status: 400 });
  }
  const { roadmapId, order, message } = parsed.data;

  if (!process.env.NIM_API_KEY) {
    return new Response(JSON.stringify({ error: "nim_not_configured" }), { status: 503 });
  }
  const tutor = checkTutorDay(userKey);
  if (!tutor.ok) {
    return new Response(JSON.stringify({ error: "tutor_limit", message: "Tutor limit reached (30/day). Back tomorrow." }), { status: 429 });
  }
  const day = checkAiDay(userKey);
  if (!day.ok) {
    return new Response(JSON.stringify({ error: "daily_limit" }), { status: 429 });
  }

  const sb = serviceClient();
  const rm = await loadRoadmap(sb, roadmapId, userKey);
  if (!rm) return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
  const node = rm.nodes.find((n) => n.order === order);
  if (!node) return new Response(JSON.stringify({ error: "bad_node" }), { status: 400 });

  // Context: last fails (weak nodes + recent low quiz scores)
  const weakTitles = rm.nodes.filter((n) => n.weak).slice(0, 3).map((n) => n.title);
  let recentMiss: string[] = [];
  try {
    const { data } = await sb
      .from("progress_events")
      .select("score,node_order")
      .eq("user_id", userKey)
      .eq("type", "quiz")
      .order("ts", { ascending: false })
      .limit(6);
    recentMiss =
      (data ?? [])
        .filter((r) => (r.score ?? 100) < 70)
        .slice(0, 3)
        .map((r) => `node ${r.node_order} scored ${r.score}%`);
  } catch { /* context degrades */ }
  const projFb =
    (node as { projectFeedback?: string }).projectFeedback ??
    (rm.nodes.find((n) => n.type === "project") as { projectFeedback?: string } | undefined)
      ?.projectFeedback ??
    null;

  const system = buildTutorSystem({
    goal: rm.goal ?? rm.title ?? "tech learner",
    nodeTitle: node.title,
    nodeSummary: node.summary,
    lastFails: [...recentMiss, ...weakTitles].slice(0, 3),
    projectFeedback: projFb,
  });

  // Load latest thread for this node (single-active roadmap => (user, order) is stable)
  let threadId: string | null = null;
  let history: { role: string; content: string }[] = [];
  try {
    const { data } = await sb
      .from("tutor_threads")
      .select("id,messages")
      .eq("user_id", userKey)
      .eq("node_order", order)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      threadId = data.id as string;
      const msgs = (data.messages as { role: string; content: string }[]) ?? [];
      history = msgs.slice(-12);
    }
  } catch { /* fresh thread */ }

  const messages = [
    { role: "system", content: system },
    ...history,
    { role: "user", content: message },
  ];

  const started = Date.now();
  const enc = new TextEncoder();
  let full = "";
  let usedFallback = false;
  let provider = "ULTRA";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: string) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${data}\n\n`));
      const trySlot = async (slot: "ULTRA" | "LIGHTNING", timeout: number) => {
        await streamNIM(slotModel(slot), messages, (tok) => {
          full += tok;
          send("token", JSON.stringify({ t: tok }));
        }, timeout);
      };
      try {
        try {
          await trySlot("ULTRA", 90000);
        } catch {
          // Fallback Ultra-stream -> Lightning-stream (plan §4)
          usedFallback = true;
          provider = "LIGHTNING";
          send("meta", JSON.stringify({ fallback: true, provider, note: "Ultra busy, switched to Lightning…" }));
          await trySlot("LIGHTNING", 60000);
        }
        if (!usedFallback) send("meta", JSON.stringify({ fallback: false, provider }));
        send("token", JSON.stringify({ done: true }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "nim_all_failed";
        send("error", JSON.stringify({ error: "nim_all_failed", detail: msg.slice(0, 200) }));
      } finally {
        controller.close();
        // Persist thread + ai log (best-effort, after stream)
        try {
          const updated = [...history, { role: "user", content: message }, { role: "assistant", content: full }];
          if (threadId) {
            await sb.from("tutor_threads").update({ messages: updated.slice(-30) }).eq("id", threadId);
          } else {
            await sb.from("tutor_threads").insert({ user_id: userKey, node_order: order, messages: updated.slice(-30) });
          }
          await logAi(sb, {
            user_id: userKey,
            task: "tutor",
            provider: full ? provider : "none",
            latency_ms: Date.now() - started,
            fallback_used: usedFallback || !full,
            ...(full ? {} : { error_code: "nim_all_failed" }),
          });
        } catch { /* persistence non-critical */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
