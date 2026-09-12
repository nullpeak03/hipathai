import { z } from "zod";
import { callerId } from "@/lib/caller";
import { loadRoadmap, serviceClient, logAi } from "@/lib/store";
import { checkTutorDayAsync, checkAiDayAsync } from "@/lib/rateLimit";
import { buildTutorSystem } from "@/lib/ai/tutorPrompts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Body = z.object({
  roadmapId: z.string().uuid(),
  order: z.number().int().min(0),
  message: z.string().min(1).max(2000),
  threadId: z.string().uuid().optional(),
  language: z.string().max(20).optional(),
});

function slotModel(slot: "ULTRA" | "LIGHTNING") {
  return slot === "ULTRA" ? process.env.NIM_ULTRA_ID! : process.env.NIM_LIGHTNING_ID!;
}
function geminiKey(): string | null {
  return process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? null;
}

async function streamGemini(
  messages: { role: string; content: string }[],
  onToken: (t: string) => void,
  timeoutMs: number,
): Promise<void> {
  const key = geminiKey();
  if (!key) throw new Error("gemini_not_configured");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash", messages, max_tokens: 1000, temperature: 0.5, stream: true }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) throw new Error(`gemini_${res.status}`);
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
          const tok: string = j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content ?? "";
          if (tok) {
            got = true;
            onToken(tok);
          }
        } catch {}
      }
    }
    if (!got) throw new Error("gemini_empty");
  } finally {
    clearTimeout(t);
  }
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
  const { roadmapId, order, message, threadId: reqThreadId, language: reqLang } = parsed.data;
  if (userKey.startsWith("anon:")) return new Response(JSON.stringify({ error: "unauthorized", message: "Sign in required" }), { status: 401 });

  if (!process.env.NIM_API_KEY && !geminiKey()) {
    return new Response(JSON.stringify({ error: "nim_not_configured" }), { status: 503 });
  }
  const tutor = await checkTutorDayAsync(userKey);
  if (!tutor.ok) {
    return new Response(JSON.stringify({ error: "tutor_limit", message: "Tutor limit reached (30/day). Back tomorrow." }), { status: 429 });
  }
  const day = await checkAiDayAsync(userKey);
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

  const lang = (reqLang ?? "python").toLowerCase();
  const system = buildTutorSystem({
    goal: rm.goal ?? rm.title ?? "tech learner",
    nodeTitle: node.title,
    nodeSummary: node.summary,
    lastFails: [...recentMiss, ...weakTitles].slice(0, 3),
    projectFeedback: projFb,
    language: lang,
  });

  // Load thread: if threadId provided, load that exact thread, else latest for (roadmap, order)
  let threadId: string | null = reqThreadId ?? null;
  let history: { role: string; content: string }[] = [];
  let threadTitle: string | null = null;
  let threadLang: string | null = null;
  try {
    if (threadId) {
      const { data } = await sb.from("tutor_threads").select("id,messages,title,language").eq("id", threadId).eq("user_id", userKey).maybeSingle();
      if (data) {
        const msgs = (data.messages as { role: string; content: string }[]) ?? [];
        history = msgs.slice(-12);
        threadTitle = (data as { title?: string }).title ?? null;
        threadLang = (data as { language?: string }).language ?? null;
      } else {
        threadId = null;
      }
    }
    if (!threadId) {
      const { data } = await sb
        .from("tutor_threads")
        .select("id,messages,title,language")
        .eq("user_id", userKey)
        .eq("node_order", order)
        .eq("roadmap_id", roadmapId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        threadId = data.id as string;
        const msgs = (data.messages as { role: string; content: string }[]) ?? [];
        history = msgs.slice(-12);
        threadTitle = (data as { title?: string }).title ?? null;
        threadLang = (data as { language?: string }).language ?? null;
      }
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
          usedFallback = true;
          provider = "LIGHTNING";
          send("meta", JSON.stringify({ fallback: true, provider, note: "Ultra busy, switched to Lightning…" }));
          try {
            await trySlot("LIGHTNING", 60000);
          } catch {
            // Final fallback: Gemini 2.5 Flash
            provider = "GEMINI";
            send("meta", JSON.stringify({ fallback: true, provider, note: "Lightning busy, switched to Gemini 2.5 Flash…" }));
            await streamGemini(messages, (tok) => {
              full += tok;
              send("token", JSON.stringify({ t: tok }));
            }, 30000);
          }
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
          const newTitle = !threadTitle || threadTitle === "New chat" ? message.slice(0, 40) : threadTitle;
          try {
            if (threadId) {
              await sb.from("tutor_threads").update({ messages: updated.slice(-30), title: newTitle, language: lang, roadmap_id: roadmapId }).eq("id", threadId);
            } else {
              await sb.from("tutor_threads").insert({ user_id: userKey, node_order: order, roadmap_id: roadmapId, language: lang, title: newTitle, messages: updated.slice(-30) });
            }
          } catch (e) {
            if (/column .* does not exist/i.test(String(e))) {
              if (threadId) {
                await sb.from("tutor_threads").update({ messages: updated.slice(-30) }).eq("id", threadId);
              } else {
                await sb.from("tutor_threads").insert({ user_id: userKey, node_order: order, messages: updated.slice(-30) });
              }
            } else throw e;
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
