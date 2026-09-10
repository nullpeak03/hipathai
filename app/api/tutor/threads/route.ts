import { NextResponse } from "next/server";
import { z } from "zod";
import { callerId } from "@/lib/caller";
import { serviceClient } from "@/lib/store";

export const dynamic = "force-dynamic";

const Q = z.object({
  order: z.coerce.number().int().min(0).optional(),
  roadmapId: z.string().uuid().optional(),
  q: z.string().max(100).optional(),
});

// Thread history for modern sidebar (ChatGPT-like) + per-lesson filter
export async function GET(req: Request) {
  const userKey = await callerId(req);
  const url = new URL(req.url);
  const q = Q.safeParse({
    order: url.searchParams.get("order") ?? undefined,
    roadmapId: url.searchParams.get("roadmapId") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  });
  const order = q.success ? q.data.order : undefined;
  const roadmapId = q.success ? q.data.roadmapId : undefined;
  const search = q.success ? q.data.q : undefined;
  const sb = serviceClient();
  try {
    let query = sb
      .from("tutor_threads")
      .select("id,node_order,roadmap_id,title,language,messages,created_at,updated_at")
      .eq("user_id", userKey)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (order !== undefined) query = query.eq("node_order", order);
    if (roadmapId) query = query.eq("roadmap_id", roadmapId);
    if (search) query = query.ilike("title", `%${search}%`);
    const { data, error } = await query;
    if (error) {
      // Fallback for DB before 003 migration (missing new columns)
      if (/column .* does not exist/i.test(error.message)) {
        let fallback = sb.from("tutor_threads").select("id,node_order,messages,created_at").eq("user_id", userKey).order("created_at", { ascending: false }).limit(50);
        if (order !== undefined) fallback = fallback.eq("node_order", order);
        const { data: fbData, error: fbErr } = await fallback;
        if (fbErr) throw new Error(fbErr.message);
        return NextResponse.json({ threads: (fbData ?? []).map((r: Record<string, unknown>) => ({ ...r, roadmap_id: null, title: (r.messages as {content:string}[] )?.[0]?.content?.slice(0,40) ?? "New chat", language: "python", updated_at: r.created_at })) });
      }
      throw new Error(error.message);
    }
    return NextResponse.json({ threads: data ?? [] });
  } catch (e) {
    return NextResponse.json({ threads: [], error: e instanceof Error ? e.message : "failed" });
  }
}

const PostBody = z.object({
  roadmapId: z.string().uuid().optional(),
  node_order: z.number().int().min(0).optional(),
  language: z.string().max(20).optional(),
  title: z.string().max(80).optional(),
});

export async function POST(req: Request) {
  const userKey = await callerId(req);
  const parsed = PostBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const sb = serviceClient();
  let data: { id: string } | null = null;
  let error: { message: string } | null = null;
  try {
    const res = await sb
      .from("tutor_threads")
      .insert({
        user_id: userKey,
        roadmap_id: parsed.data.roadmapId ?? null,
        node_order: parsed.data.node_order ?? null,
        language: parsed.data.language ?? "python",
        title: parsed.data.title ?? "New chat",
        messages: [],
      })
      .select("id")
      .single();
    data = res.data as { id: string } | null;
    error = res.error as { message: string } | null;
    if (error && /column .* does not exist/i.test(error.message)) throw new Error(error.message);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/column .* does not exist/i.test(msg)) {
      const fb = await sb.from("tutor_threads").insert({ user_id: userKey, node_order: parsed.data.node_order ?? null, messages: [] }).select("id").single();
      data = fb.data as { id: string } | null;
      error = fb.error as { message: string } | null;
    } else {
      error = { message: msg };
    }
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data!.id });
}

export async function PATCH(req: Request) {
  const userKey = await callerId(req);
  const body = await req.json().catch(() => null);
  const parsed = z.object({ id: z.string().uuid(), title: z.string().min(1).max(80) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const sb = serviceClient();
  const { error } = await sb.from("tutor_threads").update({ title: parsed.data.title }).eq("id", parsed.data.id).eq("user_id", userKey);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const userKey = await callerId(req);
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const sb = serviceClient();
  const { error } = await sb.from("tutor_threads").delete().eq("id", id).eq("user_id", userKey);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
